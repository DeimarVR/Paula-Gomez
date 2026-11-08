import { AppointmentStatus } from '@prisma/client';
import { env } from '@/server/config/env';
import { prisma } from '@/server/lib/prisma';
import { addMinutes, parseZonedDateTime, toZonedDateKey } from '@/server/lib/datetime';
import { requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lo que necesita la pantalla «Hoy» del panel, en una sola ida.
 *
 * «Hoy» es el día del centro, no el del servidor. Antes se calculaba con
 * `setHours(0)` en la hora del servidor —UTC en Vercel—, así que entre las
 * 7 de la noche y la medianoche de Colombia el tablero ya mostraba las citas
 * de mañana como si fueran de hoy.
 */
export const GET = route(async (req) => {
  const usuario = requireAuth(req);
  const zona = env.CLINIC_TIMEZONE;

  const ahora = new Date();
  const hoy = toZonedDateKey(ahora, zona);
  const inicio = parseZonedDateTime(hoy, '00:00', zona);
  const fin = parseZonedDateTime(toZonedDateKey(addMinutes(inicio, 36 * 60), zona), '00:00', zona);
  const finDeSemana = addMinutes(inicio, 7 * 24 * 60);

  const [citas, semana, cierre, recientes] = await Promise.all([
    prisma.appointment.findMany({
      where: { startsAt: { gte: inicio, lt: fin } },
      orderBy: { startsAt: 'asc' },
      select: {
        id: true,
        contactName: true,
        contactPhone: true,
        startsAt: true,
        endsAt: true,
        status: true,
        needsReschedule: true,
        patientId: true,
        message: true,
      },
    }),
    prisma.appointment.count({
      where: {
        startsAt: { gte: inicio, lt: finDeSemana },
        status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] },
      },
    }),
    prisma.blackout.findUnique({ where: { dateKey: hoy }, select: { reason: true } }),
    // Los expedientes que alguien tocó hace poco: a los que se vuelve.
    prisma.patient.findMany({
      where: { clinicalUpdatedAt: { not: null } },
      orderBy: { clinicalUpdatedAt: 'desc' },
      take: 4,
      select: { id: true, fullName: true, clinicalUpdatedAt: true, clinicalUpdatedBy: true },
    }),
  ]);

  const activas = citas.filter(
    (c) => c.status === AppointmentStatus.PENDIENTE || c.status === AppointmentStatus.CONFIRMADA,
  );

  return {
    saludoA: usuario.fullName,
    fecha: hoy,
    cerrado: cierre ? { motivo: cierre.reason } : null,
    citas,
    /** La que está ocurriendo ahora mismo, si hay. */
    ahora: activas.find((c) => c.startsAt <= ahora && c.endsAt > ahora) ?? null,
    /** La siguiente que todavía no empieza. */
    siguiente: activas.find((c) => c.startsAt > ahora) ?? null,
    cuentas: {
      hoy: citas.filter((c) => c.status !== AppointmentStatus.CANCELADA).length,
      confirmadas: citas.filter((c) => c.status === AppointmentStatus.CONFIRMADA).length,
      porConfirmar: citas.filter((c) => c.status === AppointmentStatus.PENDIENTE).length,
      atendidas: citas.filter((c) => c.status === AppointmentStatus.COMPLETADA).length,
      canceladas: citas.filter((c) => c.status === AppointmentStatus.CANCELADA).length,
      semana,
    },
    recientes,
  };
});
