import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';

/**
 * Borrar un paciente de verdad, y cuándo no se puede.
 *
 * Existe por un caso muy concreto: el duplicado. El mismo paciente entra dos
 * veces —lo agenda él por la web y la auxiliar lo vuelve a crear, o se escribe
 * mal el nombre y se crea otro— y queda una ficha vacía que ensucia la lista y
 * la búsqueda. Eso no es historia clínica, es basura, y se borra.
 *
 * ── La regla ─────────────────────────────────────────────────────────────
 *
 * Se borra SOLO si no tiene nada colgando. Ni una cita, ni una ficha, ni una
 * factura, ni una foto. Si tiene algo, no se borra: se marca como inactivo y
 * desaparece de la operación diaria sin que nadie pierda un dato.
 *
 * La tentación es dejar borrar «avisando». No se hace, y la razón está en el
 * esquema: `TreatmentPlan`, `PhotoRecord`, `FacialRecord` y `SignedConsent`
 * están en cascada, así que borrar el paciente se llevaría por delante sus
 * fotos de antes y después, sus fichas faciales y sus consentimientos FIRMADOS
 * sin que nada quede en ningún sitio. Un consentimiento firmado es el papel que
 * respalda al centro si mañana hay un reclamo. Ningún clic de la lista de
 * pacientes debería poder destruir eso, por mucho que quien lo dio estuviera
 * seguro.
 *
 * Y al revés: quien tiene una duda razonable —«¿este es el duplicado o el
 * bueno?»— la resuelve mirando lo que devuelve `queTieneElPaciente`, que es
 * justo lo que el diálogo enseña antes de preguntar.
 */

export interface LoQueTiene {
  citas: number;
  fichas: number;
  fichasFaciales: number;
  facturas: number;
  fotos: number;
  planes: number;
  consentimientos: number;
  /** Salidas de inventario anotadas a su nombre. */
  movimientos: number;
  /** Del expediente general: notas de evolución, medicación y hojas en papel. */
  notas: number;
  medicamentos: number;
  hojas: number;
}

export interface EstadoDeBorrado {
  id: string;
  nombre: string;
  activo: boolean;
  tiene: LoQueTiene;
  /** Está vacío: se puede borrar sin que se pierda nada. */
  sePuedeBorrar: boolean;
  /** «3 citas», «1 ficha clínica»… ya en castellano y en singular o plural. */
  resumen: string[];
}

/** Las etiquetas, en singular y plural, para no armarlas en la pantalla. */
const NOMBRES: Array<[keyof LoQueTiene, string, string]> = [
  ['citas', 'cita', 'citas'],
  ['fichas', 'ficha clínica', 'fichas clínicas'],
  ['fichasFaciales', 'ficha facial', 'fichas faciales'],
  ['facturas', 'factura', 'facturas'],
  ['fotos', 'registro de fotos', 'registros de fotos'],
  ['planes', 'plan de tratamiento', 'planes de tratamiento'],
  ['consentimientos', 'consentimiento firmado', 'consentimientos firmados'],
  ['movimientos', 'movimiento de inventario', 'movimientos de inventario'],
  ['notas', 'nota de evolución', 'notas de evolución'],
  ['medicamentos', 'medicamento anotado', 'medicamentos anotados'],
  ['hojas', 'hoja del historial en papel', 'hojas del historial en papel'],
];

function enPalabras(tiene: LoQueTiene): string[] {
  return NOMBRES.filter(([clave]) => tiene[clave] > 0).map(
    ([clave, singular, plural]) =>
      `${tiene[clave]} ${tiene[clave] === 1 ? singular : plural}`,
  );
}

/**
 * Qué tiene guardado el paciente.
 *
 * Se cuenta TODO lo que cuelga de él, no solo lo que se vería en su ficha. Un
 * movimiento de inventario a su nombre o una factura del mostrador no aparecen
 * en la historia clínica y valen igual para decidir si esto es un duplicado
 * vacío o una persona con recorrido en el centro.
 */
/** Vale el cliente normal y el de una transacción: se cuenta en los dos sitios. */
type Cliente = Prisma.TransactionClient;

async function contar(cliente: Cliente, id: string): Promise<EstadoDeBorrado> {
  const paciente = await cliente.patient.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      active: true,
      _count: {
        select: {
          appointments: true,
          records: true,
          facialRecords: true,
          invoices: true,
          photoRecords: true,
          plans: true,
          signedConsents: true,
          stockMoves: true,
          evolutionNotes: true,
          medications: true,
          paperSheets: true,
        },
      },
    },
  });

  if (!paciente) throw HttpError.notFound('Paciente no encontrado');

  const tiene: LoQueTiene = {
    citas: paciente._count.appointments,
    fichas: paciente._count.records,
    fichasFaciales: paciente._count.facialRecords,
    facturas: paciente._count.invoices,
    fotos: paciente._count.photoRecords,
    planes: paciente._count.plans,
    consentimientos: paciente._count.signedConsents,
    movimientos: paciente._count.stockMoves,
    notas: paciente._count.evolutionNotes,
    medicamentos: paciente._count.medications,
    hojas: paciente._count.paperSheets,
  };

  const resumen = enPalabras(tiene);

  return {
    id: paciente.id,
    nombre: paciente.fullName,
    activo: paciente.active,
    tiene,
    sePuedeBorrar: resumen.length === 0,
    resumen,
  };
}

export function queTieneElPaciente(id: string): Promise<EstadoDeBorrado> {
  return contar(prisma, id);
}

/** El texto del «no se puede», con lo que tiene dentro. */
function motivoDeNegativa(estado: EstadoDeBorrado): string {
  return (
    `${estado.nombre} no se puede borrar porque tiene ${estado.resumen.join(', ')}. ` +
    'Para que no aparezca en la lista, márcalo como inactivo: se guarda todo y deja de estorbar.'
  );
}

/**
 * Borra el paciente, si está vacío.
 *
 * ── Por qué se cuenta aquí y no en la pantalla ───────────────────────────
 *
 * Entre que se abre el diálogo y se confirma pueden pasar minutos, y en ese
 * rato se le puede haber agendado una cita desde otro computador. Comprobar
 * solo en el navegador haría que el borrado dependiera de lo que el navegador
 * creía hace cinco minutos.
 *
 * ── Por qué además va bloqueado ──────────────────────────────────────────
 *
 * Contar y borrar en dos pasos sueltos deja una rendija de milisegundos: se
 * cuenta cero, alguien guarda un consentimiento firmado, y el borrado se lo
 * lleva en cascada. Las dos operaciones responden «listo» y el documento
 * desaparece sin que nadie se entere. No es teórico: probándolo con las dos
 * cosas a la vez, 4 de cada 25 intentos destruían el consentimiento.
 *
 * El `FOR UPDATE` cierra la rendija. Postgres, para insertar una fila que
 * apunte a este paciente, necesita un bloqueo sobre su fila que es
 * incompatible con este; así que mientras se cuenta y se borra, nadie puede
 * colgarle nada. El que llegue tarde se encuentra con que el paciente ya no
 * existe y su inserción falla, que es exactamente lo correcto.
 */
export async function borrarPaciente(id: string): Promise<{ nombre: string }> {
  return prisma.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM patients WHERE id = ${id} FOR UPDATE
    `;
    if (filas.length === 0) throw HttpError.notFound('Paciente no encontrado');

    const estado = await contar(tx, id);
    if (!estado.sePuedeBorrar) {
      throw HttpError.unprocessable(motivoDeNegativa(estado));
    }

    await tx.patient.delete({ where: { id } });

    return { nombre: estado.nombre };
  });
}

/**
 * La otra salida: dejarlo fuera de la operación sin tocar nada.
 *
 * Es lo que se ofrece cuando el borrado no procede. No es un borrado a medias:
 * el paciente sigue entero, con su historia y sus documentos, y se puede
 * reactivar editándolo.
 */
export async function archivarPaciente(id: string): Promise<{ nombre: string }> {
  const paciente = await prisma.patient.findUnique({
    where: { id },
    select: { id: true, fullName: true },
  });
  if (!paciente) throw HttpError.notFound('Paciente no encontrado');

  await prisma.patient.update({ where: { id }, data: { active: false } });
  return { nombre: paciente.fullName };
}
