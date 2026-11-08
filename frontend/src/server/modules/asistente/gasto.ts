import { env } from '@/server/config/env';
import { prisma } from '@/server/lib/prisma';
import { createLogger } from '@/server/lib/logger';
import { hoyEnLaClinica } from './lenguaje';

const log = createLogger('asistente');

/**
 * El tope de uso de la IA.
 *
 * No es un sistema de planes: [NOMBRE_CLÍNICA] es un solo centro y no hay a quién
 * cobrarle por separado. Lo que hace falta es que un bucle, una pestaña
 * olvidada o alguien jugando no se conviertan en una factura sorpresa a fin de
 * mes. Por eso se cuenta por clínica, no por persona.
 *
 * Se cuentan LLAMADAS, no tokens. Es menos preciso y mucho más fácil de
 * entender: «hoy se usó 120 de 300 veces» se lee de un vistazo, y a esta
 * escala la diferencia entre una llamada y otra no mueve la aguja.
 *
 * Se guarda en `settings`, que ya existe. Una tabla nueva para dos contadores
 * sería una migración y un modelo más que mantener.
 */

const CLAVE_DIA = 'ia_consumo_dia';
const CLAVE_MES = 'ia_consumo_mes';

interface Contador {
  periodo: string;
  usado: number;
}

function leer(valor: string | undefined, periodo: string): Contador {
  if (!valor) return { periodo, usado: 0 };
  try {
    const guardado = JSON.parse(valor) as Contador;
    // De otro día o de otro mes: el contador arranca de cero solo.
    if (guardado.periodo !== periodo) return { periodo, usado: 0 };
    return { periodo, usado: Math.max(0, Number(guardado.usado) || 0) };
  } catch {
    return { periodo, usado: 0 };
  }
}

export interface EstadoDelGasto {
  dia: { usado: number; tope: number };
  mes: { usado: number; tope: number };
}

/** Cuánto se lleva usado. Para enseñarlo en el panel sin reservar nada. */
export async function comoVaElGasto(): Promise<EstadoDelGasto> {
  const hoy = hoyEnLaClinica();
  const mes = hoy.slice(0, 7);

  const filas = await prisma.setting.findMany({ where: { key: { in: [CLAVE_DIA, CLAVE_MES] } } });
  const porClave = new Map(filas.map((f) => [f.key, f.value]));

  return {
    dia: { usado: leer(porClave.get(CLAVE_DIA), hoy).usado, tope: env.AI_TOPE_DIARIO },
    mes: { usado: leer(porClave.get(CLAVE_MES), mes).usado, tope: env.AI_TOPE_MENSUAL },
  };
}

/**
 * El cerrojo que serializa las reservas.
 *
 * Sin él, dos peticiones a la vez leen el mismo contador, suman cada una por
 * su lado y la última pisa a la primera: se gastan dos llamadas y queda
 * contada una. No es teórico, lo midió la prueba — veinte reservas a la vez se
 * contaban como tres, y el tope habría dejado pasar siete veces más llamadas
 * de las permitidas.
 *
 * Una transacción no basta: en el nivel de aislamiento que usa Postgres por
 * defecto, leer y luego escribir no es una sola operación. El cerrojo de
 * Postgres sí lo vuelve una, y se suelta solo al terminar la transacción.
 */
const CERROJO = 'SELECT pg_advisory_xact_lock(hashtext($1))';

/**
 * Aparta una llamada antes de hacerla. Devuelve false si ya no hay.
 *
 * Se reserva ANTES y no se cuenta después a propósito: si se contara al
 * terminar, veinte peticiones a la vez pasarían todas el control antes de que
 * ninguna sumara.
 *
 * Los dos contadores se escriben en la misma transacción para que no quede uno
 * sumado y el otro no.
 */
export async function reservar(cuantas = 1): Promise<boolean> {
  const hoy = hoyEnLaClinica();
  const mes = hoy.slice(0, 7);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(CERROJO, 'ia_consumo');

    const filas = await tx.setting.findMany({ where: { key: { in: [CLAVE_DIA, CLAVE_MES] } } });
    const porClave = new Map(filas.map((f) => [f.key, f.value]));

    const dia = leer(porClave.get(CLAVE_DIA), hoy);
    const delMes = leer(porClave.get(CLAVE_MES), mes);

    // Tope en 0 significa sin tope, no «ni una».
    if (env.AI_TOPE_DIARIO > 0 && dia.usado + cuantas > env.AI_TOPE_DIARIO) return false;
    if (env.AI_TOPE_MENSUAL > 0 && delMes.usado + cuantas > env.AI_TOPE_MENSUAL) return false;

    await guardar(tx, CLAVE_DIA, { periodo: hoy, usado: dia.usado + cuantas });
    await guardar(tx, CLAVE_MES, { periodo: mes, usado: delMes.usado + cuantas });
    return true;
  });
}

/**
 * Devuelve lo reservado cuando la llamada no llegó a hacerse.
 *
 * Nunca baja de cero: si el contador se reinició entre la reserva y la
 * devolución —pasa a medianoche, o al cambiar de mes— devolver dejaría un
 * número negativo que luego regala llamadas.
 */
export async function devolver(cuantas = 1): Promise<void> {
  const hoy = hoyEnLaClinica();
  const mes = hoy.slice(0, 7);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(CERROJO, 'ia_consumo');

      const filas = await tx.setting.findMany({ where: { key: { in: [CLAVE_DIA, CLAVE_MES] } } });
      const porClave = new Map(filas.map((f) => [f.key, f.value]));

      const dia = leer(porClave.get(CLAVE_DIA), hoy);
      const delMes = leer(porClave.get(CLAVE_MES), mes);

      await guardar(tx, CLAVE_DIA, { periodo: hoy, usado: Math.max(0, dia.usado - cuantas) });
      await guardar(tx, CLAVE_MES, { periodo: mes, usado: Math.max(0, delMes.usado - cuantas) });
    });
  } catch (fallo) {
    /*
     * Que falle la devolución no puede tumbar la petición: la persona ya tiene
     * su problema (la IA no respondió) y sumarle un error de base no ayuda. Se
     * pierde una llamada del cupo y queda escrito en el log.
     */
    log.error('no se pudo devolver el cupo', { detalle: String(fallo).slice(0, 200) });
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

function guardar(tx: Tx, key: string, contador: Contador) {
  const value = JSON.stringify(contador);
  return tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
