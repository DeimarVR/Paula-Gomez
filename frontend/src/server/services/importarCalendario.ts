import { AppointmentSource, AppointmentStatus } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { tokenDeEnlace } from '../lib/tokens';
import { addDays, addMinutes } from '../lib/datetime';
import { CITA } from '@/lib/agenda';
import * as calendar from './googleCalendar';
import { listarEventos, type EventoDelCalendario } from './googleCalendar';
import { servicioDeLaCita } from '../modules/appointments/servicioDeLaCita';
import { esEventoDeCita, leerTituloDeCita, type CitaLeida } from './tituloDeCita';

const log = createLogger('importar-calendario');

/**
 * Trae al sistema las citas que se anotaron en Google Calendar a mano.
 *
 * El problema que resuelve: en el mostrador la señal se cae, y sin internet no
 * se puede agendar en el panel. La app de Calendar del celular sí funciona sin
 * señal —guarda el evento en el teléfono y lo sube sola cuando vuelve la
 * conexión—, así que sirve de libreta. Esto es lo que recoge esa libreta.
 *
 * Reglas, en orden de importancia:
 *
 * 1. NO se importa nada que no empiece por «Cita:». El calendario del centro
 *    también tiene reuniones y pedidos, y sin ese filtro cada almuerzo anotado
 *    se convertiría en un paciente.
 * 2. NO se toca lo que ya existe. Un evento que el propio sistema creó ya
 *    tiene su cita, y se reconoce por el identificador del evento.
 * 3. NO se inventa nada. Lo que no se entiende se reporta para que una persona
 *    lo mire; no se rellena con un valor por defecto disimulado.
 * 4. Se importa aunque falten datos. Una cita a medias, marcada como tal, es
 *    mucho mejor que una cita perdida: el paciente va a llegar igual.
 */

/** Ventana que se mira del calendario. */
const DIAS_ATRAS = 30;
const DIAS_ADELANTE = 90;

export interface ResultadoImportacion {
  creadas: Array<{ paciente: string; cuando: Date; tratamiento: string; avisos: string[] }>;
  yaEstaban: number;
  ignorados: number;
  noSeEntendieron: Array<{ titulo: string; motivo: string }>;
  errores: Array<{ titulo: string; motivo: string }>;
}

/** El teléfono como lo guarda la base: con indicativo y sin «+». */
function telefonoGuardable(telefono: string | null): string {
  return telefono ? `57${telefono}` : '';
}

/**
 * Busca al paciente antes de crear uno nuevo.
 *
 * Por cédula primero, que es lo único que identifica de verdad. Por teléfono
 * después: es lo que ya nos salvó de duplicar a Cristian cuando la cédula venía
 * mal escrita. Por nombre NO se busca: hay dos Moncayo y dos Yela en la base, y
 * un homónimo mal unido mezcla dos historias clínicas.
 */
async function buscarOCrearPaciente(cita: CitaLeida): Promise<{ id: string; creado: boolean }> {
  const telefono = telefonoGuardable(cita.telefono);

  if (cita.documento) {
    const porDocumento = await prisma.patient.findUnique({
      where: { documentId: cita.documento },
      select: { id: true },
    });
    if (porDocumento) return { id: porDocumento.id, creado: false };
  }

  if (telefono) {
    const porTelefono = await prisma.patient.findFirst({
      where: { phone: telefono },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (porTelefono) return { id: porTelefono.id, creado: false };
  }

  const faltantes: string[] = [];
  if (!cita.telefono) faltantes.push('el teléfono');
  if (!cita.documento) faltantes.push('la cédula');

  const creado = await prisma.patient.create({
    data: {
      fullName: cita.nombre,
      documentId: cita.documento,
      phone: telefono,
      publicToken: tokenDeEnlace(),
      medicalNotes: faltantes.length
        ? `Agendado desde Google Calendar. Falta ${faltantes.join(' y ')}.`
        : 'Agendado desde Google Calendar.',
    },
    select: { id: true },
  });
  return { id: creado.id, creado: true };
}

export async function importarCitasDelCalendario(): Promise<ResultadoImportacion> {
  const resultado: ResultadoImportacion = {
    creadas: [], yaEstaban: 0, ignorados: 0, noSeEntendieron: [], errores: [],
  };

  const ahora = new Date();
  const eventos = await listarEventos(addDays(ahora, -DIAS_ATRAS), addDays(ahora, DIAS_ADELANTE));

  const deCitas = eventos.filter((e) => esEventoDeCita(e.titulo));
  resultado.ignorados = eventos.length - deCitas.length;
  if (deCitas.length === 0) return resultado;

  /**
   * Se preguntan de una sola vez los eventos ya importados, en vez de uno por
   * uno dentro del bucle: con noventa días de agenda eso serían noventa idas a
   * la base para no hacer nada.
   */
  const yaImportados = new Set(
    (
      await prisma.appointment.findMany({
        where: { googleEventId: { in: deCitas.map((e) => e.id) } },
        select: { googleEventId: true },
      })
    ).map((a) => a.googleEventId as string),
  );

  // Un solo tipo de cita: lo que diga el título sobre el tratamiento queda en
  // la nota y no decide nada.
  const servicio = await servicioDeLaCita();

  for (const evento of deCitas) {
    if (yaImportados.has(evento.id)) {
      resultado.yaEstaban += 1;
      continue;
    }

    const cita = leerTituloDeCita(evento.titulo, evento.descripcion);
    if (!cita) {
      resultado.noSeEntendieron.push({
        titulo: evento.titulo,
        motivo: 'No se encontró un nombre de paciente después de «Cita:»',
      });
      continue;
    }
    // El lector avisa cuando el título no trae tratamiento; ya no hace falta.
    cita.avisos = cita.avisos.filter((a) => !a.includes('tratamiento'));

    try {
      await crearCitaImportada(evento, cita, servicio, resultado);
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      log.error('No se pudo importar el evento', { titulo: evento.titulo, motivo });
      resultado.errores.push({ titulo: evento.titulo, motivo });
    }
  }

  return resultado;
}

async function crearCitaImportada(
  evento: EventoDelCalendario,
  cita: CitaLeida,
  servicio: { id: string; name: string },
  resultado: ResultadoImportacion,
): Promise<void> {
  const paciente = await buscarOCrearPaciente(cita);

  /**
   * La hora sale del evento, no del catálogo.
   *
   * Es una cita que YA se acordó con el paciente: el sistema la registra, no la
   * decide. Por eso tampoco se comprueba el horario de atención ni el cruce con
   * otra cita —rechazarla no la deshace, solo la deja sin registrar y el
   * paciente llega igual—. Los cruces se ven después en la agenda, que es donde
   * alguien puede resolverlos hablando con el paciente.
   */
  const fin = evento.fin > evento.inicio ? evento.fin : addMinutes(evento.inicio, CITA.duracionMin);

  const avisos = [...cita.avisos];
  if (paciente.creado) avisos.push('Paciente nuevo, creado desde el calendario');

  const nota = [
    'Agendada desde Google Calendar sin conexión.',
    `Título del evento: ${evento.titulo}`,
    cita.tratamiento ? `Motivo anotado: ${cita.tratamiento}.` : '',
    ...cita.avisos,
  ]
    .filter(Boolean)
    .join(' ');

  await prisma.appointment.create({
    data: {
      serviceId: servicio.id,
      patientId: paciente.id,
      contactName: cita.nombre,
      contactPhone: telefonoGuardable(cita.telefono),
      message: nota,
      startsAt: evento.inicio,
      endsAt: fin,
      status: AppointmentStatus.PENDIENTE,
      source: AppointmentSource.PRESENCIAL,
      // Es lo que impide importarla dos veces: la próxima pasada ve este
      // identificador y sabe que ese evento ya tiene su cita.
      googleEventId: evento.id,
      googleHtmlLink: evento.htmlLink,
      manageToken: tokenDeEnlace(),
    },
  });

  /*
   * El evento escrito a mano queda como «disponible» en Google, igual que los
   * que crea el sistema. Si siguiera como ocupado, la cita se estorbaría a sí
   * misma al moverla, y al cancelarla su hora no se liberaría hasta que alguien
   * borrara el evento. Si Google no responde, la cita queda importada igual.
   */
  await calendar
    .updateEvent(evento.id, { transparente: true })
    .catch((error) => log.warn('No se pudo marcar el evento como disponible', error));

  resultado.creadas.push({
    paciente: cita.nombre,
    cuando: evento.inicio,
    tratamiento: servicio.name,
    avisos,
  });
}

/** Para el resumen del cron, en una línea. */
export function resumirImportacion(r: ResultadoImportacion): string {
  const partes = [`${r.creadas.length} citas nuevas`];
  if (r.yaEstaban) partes.push(`${r.yaEstaban} ya estaban`);
  if (r.noSeEntendieron.length) partes.push(`${r.noSeEntendieron.length} sin entender`);
  if (r.errores.length) partes.push(`${r.errores.length} con error`);
  return partes.join(', ');
}

/** Igual que arriba, pero sin reventar si Google no está conectado. */
export async function importarSiSePuede(): Promise<string> {
  if (!env.GOOGLE_REFRESH_TOKEN) return 'agenda de Google sin conectar: no se importó nada';
  try {
    return resumirImportacion(await importarCitasDelCalendario());
  } catch (error) {
    const motivo = error instanceof Error ? error.message : String(error);
    log.error('Falló la importación desde el calendario', motivo);
    return `no se pudo importar: ${motivo}`;
  }
}
