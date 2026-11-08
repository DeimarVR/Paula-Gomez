import { AppointmentSource, AppointmentStatus, type Appointment } from '@prisma/client';
import { CITA } from '@/lib/agenda';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { conCerrojoDeAgenda } from '../../lib/cerrojo';
import { HttpError } from '../../lib/httpError';
import { addMinutes, formatLongEs, toZonedDateKey } from '../../lib/datetime';
import { normalizePhone } from '../../lib/phone';
import { tokenDeEnlace } from '../../lib/tokens';
import { MAX_ADVANCE_DAYS, assertSlotIsFree, getAvailability } from '../../services/availability';
import * as calendar from '../../services/googleCalendar';
import * as whatsapp from '../../services/whatsapp';
import { createLogger } from '../../lib/logger';
import { conNota, datosDelEvento, enlaceDeCita, ponerEnGoogle } from './eventoDeCita';
import { anularOfertasQuePisan, ofrecerHuecoLiberado } from './ofertas.service';
import { servicioDeLaCita } from './servicioDeLaCita';

const log = createLogger('appointments');

const ACTIVAS: AppointmentStatus[] = [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA];
const esActiva = (estado: AppointmentStatus) => ACTIVAS.includes(estado);

export interface CreateBookingInput {
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  message?: string;
  startsAt: Date;
  source?: AppointmentSource;
  patientId?: string;
  /**
   * La agenda el centro, no el formulario público.
   *
   * Salta la anticipación mínima, el tope de 60 días y que la hora sea el
   * comienzo de un bloque; el horario de atención y el cruce con otra cita se
   * comprueban igual.
   */
  desdeElPanel?: boolean;
}

export interface BookingResult {
  appointment: Appointment;
  calendarSynced: boolean;
  whatsappSent: boolean;
  /** Enlace wa.me listo por si el envío automático no está disponible. */
  whatsappLink: string;
  manageUrl: string;
}

/**
 * Manda al calendario una cita que se quedó sin evento.
 *
 * Existe porque la sincronización es deliberadamente silenciosa: si Google no
 * responde, la cita se guarda igual y `googleEventId` queda en null —perder una
 * reserva porque falló una integración sería mucho peor—. El precio de esa
 * decisión es que alguien tiene que poder reintentarlo después, y esto es ese
 * botón. Es idempotente: si la cita ya tiene evento, no crea un segundo.
 */
export async function sincronizarConCalendario(id: string) {
  const cita = await prisma.appointment.findUnique({
    where: { id },
    include: { service: { select: { name: true, durationMin: true } } },
  });
  if (!cita) throw HttpError.notFound('Cita no encontrada');

  if (cita.googleEventId) {
    return { appointment: cita, yaEstaba: true };
  }
  if (cita.status === AppointmentStatus.CANCELADA) {
    throw HttpError.unprocessable('Una cita cancelada no se manda al calendario.');
  }

  const resultado = await calendar.createEvent(datosDelEvento(cita));

  if (!resultado) {
    // El servicio devuelve null tanto si no hay conexión como si Google falló;
    // el estado distingue los dos casos y decide qué se le dice a la persona.
    const estado = await calendar.getStatus();
    if (!estado.configured) {
      throw HttpError.serviceUnavailable('Google Calendar no está configurado en el servidor.');
    }
    if (!estado.connected) {
      throw HttpError.serviceUnavailable(
        'La agenda de Google no está conectada. Un administrador puede conectarla en Integraciones.',
      );
    }
    throw HttpError.serviceUnavailable(
      estado.lastError
        ? `Google rechazó el evento: ${estado.lastError}`
        : 'Google no aceptó el evento. Vuelve a intentarlo en un momento.',
    );
  }

  const actualizada = await prisma.appointment.update({
    where: { id: cita.id },
    data: { googleEventId: resultado.eventId, googleHtmlLink: resultado.htmlLink },
    include: { service: { select: { name: true, durationMin: true } } },
  });

  return { appointment: actualizada, yaEstaba: false };
}

/**
 * Crea una reserva completa: valida el horario, guarda, sincroniza con Google
 * Calendar y avisa por WhatsApp.
 *
 * Mirar si el bloque está libre y guardar la cita pasan dentro del cerrojo de
 * la agenda: es lo que impide que dos personas que pulsan «reservar» a la vez
 * sobre el mismo bloque queden las dos agendadas.
 *
 * Las integraciones van después y fuera del cerrojo. Si Google o Meta fallan,
 * la reserva ya está a salvo en la base de datos y el centro la ve igual.
 */
export async function createBooking(input: CreateBookingInput): Promise<BookingResult> {
  const servicio = await servicioDeLaCita();

  const phone = normalizePhone(input.contactPhone);
  const startsAt = input.startsAt;
  const endsAt = addMinutes(startsAt, CITA.duracionMin);

  // Antes del cerrojo: es una llamada de red y la agenda no puede esperarla.
  const ocupadoGoogle = await calendar.getBusyIntervals(startsAt, endsAt);

  const appointment = await conCerrojoDeAgenda(async (tx) => {
    await assertSlotIsFree(tx, startsAt, endsAt, {
      desdeElPanel: input.desdeElPanel,
      ocupadoGoogle,
    });

    const creada = await tx.appointment.create({
      data: {
        serviceId: servicio.id,
        patientId: input.patientId ?? null,
        contactName: input.contactName.trim(),
        contactPhone: phone,
        contactEmail: input.contactEmail?.trim().toLowerCase() || null,
        message: input.message?.trim() || null,
        startsAt,
        endsAt,
        // La llave del enlace de «confirmar, cancelar o cambiar» que recibe el paciente.
        manageToken: tokenDeEnlace(),
        status: AppointmentStatus.PENDIENTE,
        source: input.source ?? AppointmentSource.WEB,
      },
    });

    // Si ese bloque se estaba ofreciendo como hueco liberado, ya no está libre.
    await anularOfertasQuePisan(tx, startsAt, endsAt);
    return creada;
  });

  const messageData: whatsapp.AppointmentMessageData = {
    contactName: appointment.contactName,
    contactPhone: appointment.contactPhone,
    serviceName: CITA.nombre,
    startsAt: appointment.startsAt,
    manageToken: appointment.manageToken,
  };

  const [calendarResult, whatsappResult] = await Promise.all([
    calendar.createEvent(datosDelEvento(appointment)),
    whatsapp.sendAppointmentConfirmation(messageData),
  ]);

  // Aviso interno a la clínica; que falle no afecta a la reserva.
  void whatsapp
    .notifyClinic(messageData)
    .catch((error) => log.warn('No se pudo avisar a la clínica', error));

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      googleEventId: calendarResult?.eventId ?? null,
      googleHtmlLink: calendarResult?.htmlLink ?? null,
      whatsappConfirmationSentAt: whatsappResult.sent ? new Date() : null,
    },
  });

  return {
    appointment: updated,
    calendarSynced: Boolean(calendarResult),
    whatsappSent: whatsappResult.sent,
    whatsappLink: whatsappResult.fallbackLink,
    manageUrl: enlaceDeCita(appointment.manageToken),
  };
}

/**
 * Puede elegir otra hora desde su enlace.
 *
 * Una cita viva que todavía no pasó, o una que el centro canceló al cerrar el
 * día. Una que canceló la propia persona no: para volver, reserva de nuevo.
 */
function puedeReagendarse(cita: Pick<Appointment, 'status' | 'startsAt' | 'needsReschedule'>): boolean {
  if (cita.status === AppointmentStatus.CANCELADA) return cita.needsReschedule;
  return esActiva(cita.status) && cita.startsAt > new Date();
}

/** Datos que puede ver quien tenga el enlace de gestión de la cita. */
export async function getByManageToken(manageToken: string) {
  const appointment = await prisma.appointment.findUnique({ where: { manageToken } });
  if (!appointment) throw HttpError.notFound('No encontramos esa cita');

  return {
    id: appointment.id,
    contactName: appointment.contactName,
    service: { name: CITA.nombre, durationMin: CITA.duracionMin, slug: CITA.slug },
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    status: appointment.status,
    /** La canceló el centro al cerrar el día y espera que elija otra hora. */
    needsReschedule: appointment.needsReschedule,
    puedeReagendar: puedeReagendarse(appointment),
    formattedDate: formatLongEs(appointment.startsAt, env.CLINIC_TIMEZONE),
    clinic: {
      name: env.CLINIC_NAME,
      address: env.CLINIC_ADDRESS,
      whatsapp: env.CLINIC_WHATSAPP,
    },
  };
}

export async function confirmByToken(manageToken: string) {
  const appointment = await prisma.appointment.findUnique({ where: { manageToken } });
  if (!appointment) throw HttpError.notFound('No encontramos esa cita');

  if (appointment.status === AppointmentStatus.CANCELADA) {
    throw HttpError.conflict(
      appointment.needsReschedule
        ? 'Esta cita se canceló porque ese día no habrá atención. Elija otro horario.'
        : 'Esta cita ya fue cancelada.',
    );
  }

  const confirmada = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: AppointmentStatus.CONFIRMADA },
  });

  /*
   * Aviso al centro de que el paciente confirmó. Va con `void`: si falla, la
   * confirmación ya está guardada y eso es lo que no se puede perder.
   */
  void whatsapp
    .sendText(
      env.CLINIC_WHATSAPP,
      [
        '✅ Cita confirmada por el paciente',
        '',
        `Paciente: ${appointment.contactName}`,
        `Cuándo: ${formatLongEs(appointment.startsAt, env.CLINIC_TIMEZONE)}`,
      ].join('\n'),
    )
    .catch((error) => log.warn('No se pudo avisar de la confirmación', error));

  return confirmada;
}

/** Quién canceló. Decide a quién se avisa y si el hueco se ofrece. */
export type OrigenCancelacion = 'paciente' | 'panel' | 'control';

/**
 * Cancelar una cita, venga de donde venga.
 *
 * Antes había tres caminos —el enlace del paciente, el panel y la ficha
 * clínica— y cada uno cancelaba a su manera: uno avisaba al centro, otro
 * borraba el evento de Google y otro no hacía ninguna de las dos. Ahora todos
 * pasan por aquí, y todos ofrecen el hueco que queda libre.
 */
export async function cancelarCita(
  id: string,
  { motivo, origen }: { motivo?: string | null; origen: OrigenCancelacion },
) {
  const cita = await prisma.appointment.findUnique({ where: { id } });
  if (!cita) throw HttpError.notFound('No encontramos esa cita');
  if (cita.status === AppointmentStatus.CANCELADA) return cita;

  const cancelada = await prisma.appointment.update({
    where: { id },
    data: {
      status: AppointmentStatus.CANCELADA,
      googleEventId: null,
      needsReschedule: false,
      message: conNota(cita.message, 'Cancelación', motivo),
    },
  });

  if (cita.googleEventId) {
    await calendar
      .deleteEvent(cita.googleEventId)
      .catch((error) => log.warn('No se pudo borrar el evento', error));
  }

  if (origen === 'paciente') {
    void whatsapp
      .sendText(
        env.CLINIC_WHATSAPP,
        [
          '⚠️ Cita cancelada por el paciente',
          '',
          `Paciente: ${cita.contactName}`,
          `Era: ${formatLongEs(cita.startsAt, env.CLINIC_TIMEZONE)}`,
          motivo ? `Motivo: ${motivo}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .catch((error) => log.warn('No se pudo avisar de la cancelación', error));
  }

  if (esActiva(cita.status)) {
    await ofrecerHuecoLiberado({
      startsAt: cita.startsAt,
      endsAt: cita.endsAt,
      origenCitaId: cita.id,
      origenTelefono: cita.contactPhone,
    });
  }

  return cancelada;
}

export async function cancelByToken(manageToken: string, reason?: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { manageToken },
    select: { id: true },
  });
  if (!appointment) throw HttpError.notFound('No encontramos esa cita');
  return cancelarCita(appointment.id, { motivo: reason, origen: 'paciente' });
}

/**
 * Cambiar el estado desde el panel.
 *
 * Antes era una escritura a secas, y eso dejaba dos agujeros: cancelar por
 * aquí no borraba el evento de Google ni liberaba nada, y devolver a
 * «pendiente» una cita cancelada la revivía encima de quien ya hubiera tomado
 * su hora.
 */
export async function cambiarEstado(id: string, estado: AppointmentStatus) {
  const cita = await prisma.appointment.findUnique({ where: { id } });
  if (!cita) throw HttpError.notFound('Cita no encontrada');
  if (cita.status === estado) return cita;

  if (estado === AppointmentStatus.CANCELADA) {
    return cancelarCita(id, { motivo: 'Cancelada desde el panel', origen: 'panel' });
  }

  if (cita.status === AppointmentStatus.CANCELADA) {
    throw HttpError.conflict(
      'Esta cita está cancelada y su hora pudo haberse dado a otra persona. Para recuperarla, reagéndala en un horario libre.',
    );
  }

  /*
   * Volver a «pendiente» o «confirmada» desde «no asistió» o «atendida» vuelve
   * a ocupar la hora. Si esa hora todavía no pasó, hay que mirar que siga
   * libre: pudo haberse ofrecido y tomado mientras tanto.
   */
  if (esActiva(estado) && !esActiva(cita.status) && cita.startsAt > new Date()) {
    const ocupadoGoogle = await calendar.getBusyIntervals(cita.startsAt, cita.endsAt);
    return conCerrojoDeAgenda(async (tx) => {
      await assertSlotIsFree(tx, cita.startsAt, cita.endsAt, {
        desdeElPanel: true,
        excluirCitaId: cita.id,
        ocupadoGoogle,
      });
      return tx.appointment.update({ where: { id }, data: { status: estado } });
    });
  }

  const actualizada = await prisma.appointment.update({ where: { id }, data: { status: estado } });

  /*
   * «No asistirá» marcado con tiempo deja la hora libre, igual que una
   * cancelación. Si ya pasó —el paciente simplemente no vino— no hay nada que
   * ofrecer, y el margen de tres horas lo descarta solo.
   */
  if (estado === AppointmentStatus.NO_ASISTIO && esActiva(cita.status)) {
    await ofrecerHuecoLiberado({
      startsAt: cita.startsAt,
      endsAt: cita.endsAt,
      origenCitaId: cita.id,
      origenTelefono: cita.contactPhone,
    });
  }

  return actualizada;
}

export interface OpcionesReagendar {
  desdeElPanel?: boolean;
  /**
   * Quién la mueve. Si es el propio paciente desde su enlace, la cita queda
   * confirmada —la eligió él— y se avisa al centro. Si la mueve el centro,
   * queda pendiente y el paciente recibe la nueva fecha.
   */
  origen: 'panel' | 'paciente';
}

/**
 * Mover una cita a otra hora.
 *
 * La propia cita no cuenta como ocupado: moverla diez minutos o devolverla a
 * donde estaba tiene que poder hacerse. La hora que deja libre se ofrece a
 * quienes van después.
 *
 * También sirve para devolver a la agenda una cita cancelada por un día
 * cerrado: se le pone hora nueva y vuelve a estar viva.
 */
export async function reschedule(appointmentId: string, newStartsAt: Date, opciones: OpcionesReagendar) {
  const newEndsAt = addMinutes(newStartsAt, CITA.duracionMin);
  const ocupadoGoogle = await calendar.getBusyIntervals(newStartsAt, newEndsAt);

  const { antes, despues } = await conCerrojoDeAgenda(async (tx) => {
    const cita = await tx.appointment.findUnique({ where: { id: appointmentId } });
    if (!cita) throw HttpError.notFound('Cita no encontrada');

    if (cita.status === AppointmentStatus.COMPLETADA) {
      throw HttpError.unprocessable('Una cita ya atendida no se mueve. Agenda una nueva.');
    }
    if (opciones.origen === 'paciente' && !puedeReagendarse(cita)) {
      throw HttpError.conflict(
        'Esta cita ya no se puede cambiar desde aquí. Escríbanos por WhatsApp y le ayudamos.',
      );
    }
    // Moverla a la misma hora no cambia nada y reenviaría la confirmación.
    // Una cancelada sí puede volver a su hora: eso la revive.
    if (esActiva(cita.status) && cita.startsAt.getTime() === newStartsAt.getTime()) {
      throw HttpError.unprocessable(
        opciones.origen === 'paciente' ? 'Su cita ya está a esa hora. Elija otra.' : 'La cita ya está a esa hora.',
      );
    }

    await assertSlotIsFree(tx, newStartsAt, newEndsAt, {
      desdeElPanel: opciones.desdeElPanel,
      excluirCitaId: cita.id,
      ocupadoGoogle,
    });

    const movida = await tx.appointment.update({
      where: { id: cita.id },
      data: {
        startsAt: newStartsAt,
        endsAt: newEndsAt,
        status:
          opciones.origen === 'paciente' ? AppointmentStatus.CONFIRMADA : AppointmentStatus.PENDIENTE,
        needsReschedule: false,
        whatsappReminderSentAt: null,
      },
    });
    await anularOfertasQuePisan(tx, newStartsAt, newEndsAt);

    return { antes: cita, despues: movida };
  });

  // Si estaba cancelada ya no tenía evento: `ponerEnGoogle` lo crea de nuevo.
  await ponerEnGoogle(despues).catch((error) => log.warn('No se pudo actualizar Google', error));

  const zona = env.CLINIC_TIMEZONE;
  const avisos: Array<Promise<unknown>> = [
    // La confirmación sirve de aviso de la nueva fecha, y a diferencia de un
    // texto libre puede salir por plantilla fuera de la ventana de 24 h.
    whatsapp
      .sendAppointmentConfirmation({
        contactName: despues.contactName,
        contactPhone: despues.contactPhone,
        serviceName: CITA.nombre,
        startsAt: despues.startsAt,
        manageToken: despues.manageToken,
      })
      .catch((error) => log.warn('No se pudo avisar de la nueva fecha', error)),
  ];
  if (opciones.origen === 'paciente') {
    avisos.push(
      whatsapp
        .sendText(
          env.CLINIC_WHATSAPP,
          [
            antes.needsReschedule
              ? '📅 Paciente eligió nueva hora tras el día cerrado'
              : '📅 Cita cambiada por el paciente',
            '',
            `Paciente: ${despues.contactName}`,
            `Antes: ${formatLongEs(antes.startsAt, zona)}`,
            `Ahora: ${formatLongEs(despues.startsAt, zona)}`,
          ].join('\n'),
        )
        .catch((error) => log.warn('No se pudo avisar al centro', error)),
    );
  }
  await Promise.all(avisos);

  const cambioDeHora = antes.startsAt.getTime() !== despues.startsAt.getTime();
  if (esActiva(antes.status) && cambioDeHora) {
    await ofrecerHuecoLiberado({
      startsAt: antes.startsAt,
      endsAt: antes.endsAt,
      origenCitaId: antes.id,
      origenTelefono: antes.contactPhone,
    });
  }

  return despues;
}

/* ------------------------------------------------------------------------- */
/* El paciente cambia su cita desde su enlace                                */
/* ------------------------------------------------------------------------- */

async function citaDelEnlace(manageToken: string) {
  const cita = await prisma.appointment.findUnique({ where: { manageToken } });
  if (!cita) throw HttpError.notFound('No encontramos esa cita');
  if (!puedeReagendarse(cita)) {
    throw HttpError.conflict(
      'Esta cita ya no se puede cambiar desde aquí. Escríbanos por WhatsApp y le ayudamos.',
    );
  }
  return cita;
}

/** Los horarios que puede elegir, con su propia hora como libre. */
export async function horariosParaReagendar(manageToken: string, desde?: string, dias = 14) {
  const cita = await citaDelEnlace(manageToken);
  const zona = env.CLINIC_TIMEZONE;
  const days = await getAvailability({
    fromDate: desde ?? toZonedDateKey(new Date(), zona),
    days: dias,
    excluirCitaId: cita.id,
  });

  // Su propia hora sale libre —la cita se excluye—, pero elegirla no cambia
  // nada. Se marca como suya para que la vea y no la tome de nuevo.
  if (esActiva(cita.status)) {
    const propia = cita.startsAt.toISOString();
    for (const dia of days) {
      const slot = dia.slots.find((s) => s.startsAt === propia && s.available);
      if (!slot) continue;
      slot.available = false;
      slot.motivo = 'suya';
      dia.availableCount -= 1;
    }
  }

  return { timezone: zona, maxAdvanceDays: MAX_ADVANCE_DAYS, duracionMin: CITA.duracionMin, days };
}

export async function reagendarPorElPaciente(manageToken: string, startsAt: Date) {
  // Las reglas de la web —margen, tope de días, bloques— las pone `reschedule`
  // al no venir del panel.
  const cita = await citaDelEnlace(manageToken);
  const movida = await reschedule(cita.id, startsAt, { origen: 'paciente' });
  return {
    startsAt: movida.startsAt,
    status: movida.status,
    formattedDate: formatLongEs(movida.startsAt, env.CLINIC_TIMEZONE),
  };
}
