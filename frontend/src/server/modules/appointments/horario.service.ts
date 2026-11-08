import { AppointmentStatus } from '@prisma/client';
import { CITA, aHora, aMinutos, bloquesDelDia, tramosDelDia, type HorarioDelDia } from '@/lib/agenda';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import { getZonedDayOfWeek, timeToMinutes, toZonedTime } from '../../lib/datetime';
import { horarioPorDia } from '../../services/availability';

/**
 * El horario semanal, para verlo y cambiarlo desde el panel.
 *
 * Antes solo se cambiaba editando la base o el seed. Con citas en bloques de
 * 75 minutos cada cambio mueve la agenda entera, así que quien lo edita tiene
 * que ver en el momento qué bloques salen.
 */

export interface DiaDelHorario {
  /** 0 domingo … 6 sábado. */
  dia: number;
  activo: boolean;
  apertura: string;
  cierre: string;
  pausaInicio: string | null;
  pausaFin: string | null;
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

function conBloques(dia: DiaDelHorario) {
  const horario: HorarioDelDia = {
    open: dia.apertura,
    close: dia.cierre,
    breakStart: dia.pausaInicio,
    breakEnd: dia.pausaFin,
  };
  return { ...dia, bloques: dia.activo ? bloquesDelDia(horario).map(aHora) : [] };
}

export async function leerHorario() {
  const porDia = await horarioPorDia();
  const dias: DiaDelHorario[] = [0, 1, 2, 3, 4, 5, 6].map((dia) => {
    const h = porDia[dia];
    return {
      dia,
      activo: Boolean(h),
      apertura: h?.open ?? '08:00',
      cierre: h?.close ?? '13:00',
      pausaInicio: h?.breakStart ?? null,
      pausaFin: h?.breakEnd ?? null,
    };
  });
  return { duracionMin: CITA.duracionMin, dias: dias.map(conBloques) };
}

/** Lo que está mal en un día, en palabras de quien lo edita. Null si está bien. */
function problemaDe(dia: DiaDelHorario): string | null {
  if (!dia.activo) return null;
  if (!HORA.test(dia.apertura) || !HORA.test(dia.cierre)) return 'escribe las horas como 08:00';
  if (aMinutos(dia.cierre) <= aMinutos(dia.apertura)) return 'el cierre tiene que ser después de la apertura';

  const conPausa = Boolean(dia.pausaInicio || dia.pausaFin);
  if (conPausa) {
    if (!dia.pausaInicio || !dia.pausaFin) return 'la pausa necesita inicio y fin';
    if (!HORA.test(dia.pausaInicio) || !HORA.test(dia.pausaFin)) return 'escribe la pausa como 13:00';
    const inicio = aMinutos(dia.pausaInicio);
    const fin = aMinutos(dia.pausaFin);
    if (!(aMinutos(dia.apertura) < inicio && inicio < fin && fin < aMinutos(dia.cierre))) {
      return 'la pausa tiene que quedar dentro del horario';
    }
  }

  const horario = { open: dia.apertura, close: dia.cierre, breakStart: dia.pausaInicio, breakEnd: dia.pausaFin };
  if (bloquesDelDia(horario).length === 0) {
    return `no cabe ni una cita de ${CITA.duracionMin} minutos`;
  }
  return null;
}

const NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export async function guardarHorario(dias: DiaDelHorario[]) {
  if (dias.length !== 7 || new Set(dias.map((d) => d.dia)).size !== 7) {
    throw HttpError.badRequest('Hacen falta los siete días de la semana.');
  }
  for (const dia of dias) {
    const problema = problemaDe(dia);
    if (problema) throw HttpError.badRequest(`El ${NOMBRES[dia.dia]}: ${problema}.`);
  }

  await prisma.$transaction(
    dias.map((dia) => {
      const datos = {
        openTime: dia.apertura,
        closeTime: dia.cierre,
        breakStart: dia.pausaInicio || null,
        breakEnd: dia.pausaFin || null,
        active: dia.activo,
      };
      return prisma.businessHour.upsert({
        where: { dayOfWeek: dia.dia },
        update: datos,
        create: { dayOfWeek: dia.dia, ...datos },
      });
    }),
  );

  return { ...(await leerHorario()), citasFuera: await citasFueraDelHorario() };
}

/**
 * Las citas futuras que con el horario nuevo quedan por fuera.
 *
 * Cambiar el horario no mueve ni cancela nada —esas citas ya se acordaron con
 * alguien—, pero quien acaba de cambiarlo tiene que saber que existen para
 * llamar a esas personas.
 */
async function citasFueraDelHorario() {
  const zona = env.CLINIC_TIMEZONE;
  const porDia = await horarioPorDia();
  const futuras = await prisma.appointment.findMany({
    where: {
      startsAt: { gt: new Date() },
      status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] },
    },
    orderBy: { startsAt: 'asc' },
    take: 500,
    select: { id: true, contactName: true, startsAt: true, endsAt: true },
  });

  return futuras
    .filter((cita) => {
      const delDia = porDia[getZonedDayOfWeek(cita.startsAt, zona)];
      if (!delDia) return true;
      const inicio = timeToMinutes(toZonedTime(cita.startsAt, zona));
      const duracion = Math.round((cita.endsAt.getTime() - cita.startsAt.getTime()) / 60_000);
      return !tramosDelDia(delDia).some(([desde, hasta]) => inicio >= desde && inicio + duracion <= hasta);
    })
    .map((cita) => ({ id: cita.id, nombre: cita.contactName, startsAt: cita.startsAt }));
}
