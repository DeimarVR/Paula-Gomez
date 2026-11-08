import { AppointmentStatus } from '@prisma/client';
import {
  ANTICIPACION_MINIMA_MIN,
  CITA,
  DIAS_MAXIMOS,
  HORARIO_POR_DEFECTO,
  bloquesDelDia,
  tramosDelDia,
  type HorarioDelDia,
} from '@/lib/agenda';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import type { Db } from '../lib/cerrojo';
import { HttpError } from '../lib/httpError';
import {
  addDays,
  addMinutes,
  getZonedDayOfWeek,
  minutesToTime,
  overlaps,
  parseZonedDateTime,
  timeToMinutes,
  toZonedDateKey,
  toZonedTime,
} from '../lib/datetime';
import { getBusyIntervals, type BusyInterval } from './googleCalendar';

/** Ventana máxima hacia el futuro para reservar desde la web. */
export const MAX_ADVANCE_DAYS = DIAS_MAXIMOS;

/**
 * Por qué un horario no se puede reservar.
 *
 * No es lo mismo «ya lo tomaron» que «a esa hora no se atiende». El primero
 * se dibuja en la grilla, tachado, para que el paciente entienda que ese
 * espacio existe y está tomado —si no, la hora desaparece sin explicación y
 * parece un error—. `bloqueado` es una franja tapada por la especialista (un
 * evento suyo en Google o un bloqueo de horas) y los márgenes de tiempo no se
 * muestran: llenar la pantalla de casillas muertas no le aporta a nadie.
 * `suya` solo aparece al cambiar la hora desde el enlace: es la hora que el
 * paciente ya tiene, y se muestra marcada para que no la elija de nuevo.
 */
export type MotivoNoDisponible = 'ocupado' | 'bloqueado' | 'muy-pronto' | 'muy-lejos' | 'suya';

export interface TimeSlot {
  /** "08:00" en hora local de la clínica. */
  time: string;
  /** Instante exacto en UTC, que es lo que se manda al crear la reserva. */
  startsAt: string;
  endsAt: string;
  available: boolean;
  /** Solo viene cuando `available` es false. */
  motivo?: MotivoNoDisponible;
}

export interface DayAvailability {
  /** "2026-03-14" */
  date: string;
  dayOfWeek: number;
  /** Hay horario de atención ese día de la semana. */
  open: boolean;
  /**
   * El día lo cerró la especialista desde el panel.
   *
   * Va aparte de `open` porque se explica distinto: un domingo no se atiende
   * nunca, un día cerrado es una excepción y el panel la muestra con su motivo
   * y con el botón para reabrirlo.
   */
  cerrado: { motivo: string | null } | null;
  slots: TimeSlot[];
  availableCount: number;
}

interface Franja {
  start: Date;
  end: Date;
}

interface Bloqueo extends Franja {
  dateKey: string | null;
  reason: string | null;
}

/**
 * Lo ocupado, en tres montones.
 *
 * Con una sola persona a la vez los tres tapan igual, pero se guardan aparte
 * porque se explican distinto: una cita es «ocupado», un bloqueo con fecha es
 * un día cerrado y un evento de Google es la especialista que tiene otra cosa.
 */
interface Ocupacion {
  citas: Array<Franja & { id: string; contactName: string }>;
  bloqueos: Bloqueo[];
  google: BusyInterval[];
}

async function ocupacion(
  db: Db,
  desde: Date,
  hasta: Date,
  opciones: { excluirCitaId?: string; google: BusyInterval[] },
): Promise<Ocupacion> {
  // En serie y no con Promise.all: dentro de una transacción solo hay una
  // conexión, y Prisma no admite dos consultas a la vez sobre ella.
  const citas = await db.appointment.findMany({
    where: {
      startsAt: { lt: hasta },
      endsAt: { gt: desde },
      status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] },
      ...(opciones.excluirCitaId ? { id: { not: opciones.excluirCitaId } } : {}),
    },
    select: { id: true, startsAt: true, endsAt: true, contactName: true },
  });
  const bloqueos = await db.blackout.findMany({
    where: { startsAt: { lt: hasta }, endsAt: { gt: desde } },
    select: { startsAt: true, endsAt: true, dateKey: true, reason: true },
  });

  return {
    citas: citas.map((c) => ({
      id: c.id,
      contactName: c.contactName,
      start: c.startsAt,
      end: c.endsAt,
    })),
    bloqueos: bloqueos.map((b) => ({
      start: b.startsAt,
      end: b.endsAt,
      dateKey: b.dateKey,
      reason: b.reason,
    })),
    google: opciones.google,
  };
}

/**
 * El horario de cada día de la semana.
 *
 * Manda la tabla `business_hours`, que se edita desde el panel. Si está vacía
 * —una base recién creada— rige `HORARIO_POR_DEFECTO`. Un día sin fila activa
 * es un día sin atención.
 */
export async function horarioPorDia(db: Db = prisma): Promise<Record<number, HorarioDelDia | undefined>> {
  const filas = await db.businessHour.findMany();
  if (filas.length === 0) return HORARIO_POR_DEFECTO;

  const mapa: Record<number, HorarioDelDia | undefined> = {};
  for (const fila of filas) {
    if (!fila.active) continue;
    mapa[fila.dayOfWeek] = {
      open: fila.openTime,
      close: fila.closeTime,
      breakStart: fila.breakStart,
      breakEnd: fila.breakEnd,
    };
  }
  return mapa;
}

export interface AvailabilityQuery {
  /** "2026-03-14" — primer día del rango. */
  fromDate: string;
  /** Número de días a devolver (1-31). */
  days: number;
  /**
   * La grilla es para el panel, no para la web.
   *
   * Cambia solo los dos márgenes que existen para frenar a un desconocido: la
   * anticipación mínima y el tope de días. El horario de atención y los
   * bloques valen igual para los dos. Lo pasado tampoco se ofrece; sin margen
   * quiere decir «desde ahora», no «desde esta mañana».
   */
  desdeElPanel?: boolean;
  /**
   * La cita que se está moviendo.
   *
   * Sin esto, al reagendar la propia cita sale como «ocupado» en su hora, y
   * moverla diez minutos o devolverla a donde estaba parece imposible.
   */
  excluirCitaId?: string;
}

/**
 * La disponibilidad día por día, en bloques de una cita.
 *
 * Un bloque se ofrece si: cae dentro de un tramo de atención, no lo pisa
 * ninguna cita, ni un bloqueo, ni un evento de la especialista en Google, y
 * respeta los márgenes de tiempo.
 */
export async function getAvailability(query: AvailabilityQuery): Promise<DayAvailability[]> {
  const zona = env.CLINIC_TIMEZONE;
  const dias = Math.min(Math.max(query.days, 1), 31);

  const inicioDelRango = parseZonedDateTime(query.fromDate, '00:00', zona);
  const finDelRango = addDays(inicioDelRango, dias);

  const ahora = new Date();
  const masLejano = query.desdeElPanel ? null : addDays(ahora, MAX_ADVANCE_DAYS);
  const masCercano = query.desdeElPanel ? ahora : addMinutes(ahora, ANTICIPACION_MINIMA_MIN);

  const google = await getBusyIntervals(inicioDelRango, finDelRango);
  const ocupado = await ocupacion(prisma, inicioDelRango, finDelRango, {
    excluirCitaId: query.excluirCitaId,
    google,
  });
  const horario = await horarioPorDia();

  const resultado: DayAvailability[] = [];

  for (let indice = 0; indice < dias; indice += 1) {
    const inicioDelDia = addDays(inicioDelRango, indice);
    const fecha = toZonedDateKey(inicioDelDia, zona);
    const diaDeLaSemana = getZonedDayOfWeek(inicioDelDia, zona);
    const delDia = horario[diaDeLaSemana];

    const cierre = ocupado.bloqueos.find((b) => b.dateKey === fecha);
    const base = { date: fecha, dayOfWeek: diaDeLaSemana, open: Boolean(delDia) };

    if (!delDia || cierre) {
      resultado.push({
        ...base,
        cerrado: cierre ? { motivo: cierre.reason } : null,
        slots: [],
        availableCount: 0,
      });
      continue;
    }

    const slots: TimeSlot[] = bloquesDelDia(delDia).map((minuto) => {
      const inicio = parseZonedDateTime(fecha, minutesToTime(minuto), zona);
      const fin = addMinutes(inicio, CITA.duracionMin);

      const pisa = (f: Franja) => overlaps(inicio, fin, f.start, f.end);
      const tapado = ocupado.bloqueos.some(pisa) || ocupado.google.some(pisa);
      const conCita = ocupado.citas.some(pisa);

      /*
       * El orden importa. Un bloque de hoy dentro del margen y ADEMÁS ocupado
       * se marca «muy-pronto», no «ocupado»: así se esconde, en vez de
       * mostrarle al paciente una hora tachada que nunca habría podido tomar.
       */
      const motivo: MotivoNoDisponible | undefined =
        inicio < masCercano
          ? 'muy-pronto'
          : masLejano && inicio > masLejano
            ? 'muy-lejos'
            : conCita
              ? 'ocupado'
              : tapado
                ? 'bloqueado'
                : undefined;

      return {
        time: minutesToTime(minuto),
        startsAt: inicio.toISOString(),
        endsAt: fin.toISOString(),
        available: motivo === undefined,
        ...(motivo ? { motivo } : {}),
      };
    });

    resultado.push({
      ...base,
      cerrado: null,
      slots,
      availableCount: slots.filter((s) => s.available).length,
    });
  }

  return resultado;
}

export interface OpcionesDisponibilidad {
  /**
   * Salta lo que solo protege al formulario público: la anticipación mínima,
   * el tope de días y que la hora sea justo el comienzo de un bloque.
   *
   * Desde el panel se agenda con el paciente delante: la cita de esta tarde
   * se pone media hora antes, el control cae a tres meses y a veces se acomoda
   * a las 8:30 porque así lo pidió. Lo que NO se salta es el horario de
   * atención ni el cruce con otra cita.
   */
  desdeElPanel?: boolean;
  /** La cita que se mueve: no choca consigo misma. */
  excluirCitaId?: string;
  /**
   * Lo ocupado en Google, consultado ANTES de entrar a la transacción.
   *
   * Es obligatorio a propósito. Preguntarle a Google dentro del cerrojo
   * dejaría la agenda entera esperando una respuesta de red; y olvidarse de
   * preguntar dejaría reservar encima de un compromiso de la especialista.
   */
  ocupadoGoogle: BusyInterval[];
}

/**
 * Vuelve a verificar el horario justo antes de guardar.
 *
 * Es lo que decide: entre que la persona vio la grilla y pulsó «reservar»
 * pudieron pasar minutos, y otra persona pudo tomar el mismo bloque. Hay que
 * llamarla con el cerrojo de la agenda tomado y con el `tx` de esa
 * transacción; si no, dos reservas simultáneas pasan las dos.
 */
export async function assertSlotIsFree(
  db: Db,
  startsAt: Date,
  endsAt: Date,
  opciones: OpcionesDisponibilidad,
): Promise<void> {
  const zona = env.CLINIC_TIMEZONE;
  const publico = !opciones.desdeElPanel;
  const ahora = new Date();

  if (endsAt <= startsAt) {
    throw HttpError.badRequest('El horario no es válido.');
  }
  /*
   * Lo pasado solo se frena desde la web. En el mostrador se registra a veces
   * a quien llegó sin cita, y para cuando se guarda la hora elegida ya pasó
   * por unos minutos.
   */
  if (publico && startsAt < addMinutes(ahora, ANTICIPACION_MINIMA_MIN)) {
    throw HttpError.conflict('Ese horario ya está muy próximo. Elija otro o escríbanos por WhatsApp.');
  }
  if (publico && startsAt > addDays(ahora, MAX_ADVANCE_DAYS)) {
    throw HttpError.badRequest(
      `Solo se pueden agendar citas con ${MAX_ADVANCE_DAYS} días de anticipación.`,
    );
  }

  const fecha = toZonedDateKey(startsAt, zona);
  const delDia = (await horarioPorDia(db))[getZonedDayOfWeek(startsAt, zona)];
  if (!delDia) {
    throw HttpError.conflict('Ese día no hay atención.');
  }

  const inicio = timeToMinutes(toZonedTime(startsAt, zona));
  const duracion = Math.round((endsAt.getTime() - startsAt.getTime()) / 60_000);
  const tramos = tramosDelDia(delDia);

  if (!tramos.some(([desde, hasta]) => inicio >= desde && inicio + duracion <= hasta)) {
    const pisaLaPausa =
      tramos.length === 2 && inicio < tramos[1][0] && inicio + duracion > tramos[0][1];
    throw HttpError.conflict(
      pisaLaPausa
        ? 'Ese horario cae en la pausa del almuerzo.'
        : 'Ese horario está fuera del horario de atención.',
    );
  }

  if (publico && !bloquesDelDia(delDia, duracion).includes(inicio)) {
    throw HttpError.conflict('Ese horario no está en la agenda. Elija uno de los que aparecen.');
  }

  const ocupado = await ocupacion(db, startsAt, endsAt, {
    excluirCitaId: opciones.excluirCitaId,
    google: opciones.ocupadoGoogle,
  });

  const pisa = (f: Franja) => overlaps(startsAt, endsAt, f.start, f.end);

  if (ocupado.bloqueos.some((b) => b.dateKey === fecha)) {
    throw HttpError.conflict('Ese día está cerrado en la agenda.');
  }
  if (ocupado.bloqueos.some(pisa)) {
    throw HttpError.conflict('Ese horario está bloqueado en la agenda.');
  }

  const choque = ocupado.citas.find(pisa);
  if (choque) {
    throw HttpError.conflict(
      opciones.desdeElPanel
        ? `A esa hora ya hay una cita (${choque.contactName}, ${toZonedTime(choque.start, zona)}). Elige otro horario.`
        : 'Ese horario acaba de ocuparse. Elija otro, por favor.',
    );
  }

  if (ocupado.google.some(pisa)) {
    throw HttpError.conflict(
      opciones.desdeElPanel
        ? 'La especialista tiene otro compromiso en su agenda de Google a esa hora.'
        : 'Ese horario ya no está disponible. Elija otro, por favor.',
    );
  }
}
