import { NextResponse } from 'next/server';
import { SessionStatus } from '@prisma/client';
import { env } from '@/server/config/env';
import { prisma } from '@/server/lib/prisma';
import { addDays, parseZonedDateTime, toZonedDateKey } from '@/server/lib/datetime';
import { body, requireAuth, route } from '@/server/http';
import { DEFAULT_PLAN_START_TIME, planSchema } from '../esquemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route(async (req) => {
  requireAuth(req);
  const datos = await body(req, planSchema);

  // Sin fecha explícita, el plan arranca hoy a la hora de apertura. Tomar
  // `new Date()` a secas dejaría las sesiones agendadas a las 9 de la noche
  // si el plan se crea al final del día.
  const startDate = datos.startDate
    ? new Date(datos.startDate)
    : parseZonedDateTime(
        toZonedDateKey(new Date(), env.CLINIC_TIMEZONE),
        DEFAULT_PLAN_START_TIME,
        env.CLINIC_TIMEZONE,
      );

  const plan = await prisma.treatmentPlan.create({
    data: {
      patientId: datos.patientId,
      serviceId: datos.serviceId,
      title: datos.title,
      goal: datos.goal ?? null,
      totalSessions: datos.totalSessions,
      intervalDays: datos.intervalDays,
      startDate,
      notes: datos.notes ?? null,
      ...(datos.autoSchedule
        ? {
            sessions: {
              create: Array.from({ length: datos.totalSessions }, (_, index) => ({
                sessionNumber: index + 1,
                scheduledAt: addDays(startDate, index * datos.intervalDays),
                status: SessionStatus.PROGRAMADA,
              })),
            },
          }
        : {}),
    },
    include: { sessions: { orderBy: { sessionNumber: 'asc' } } },
  });

  return NextResponse.json(plan, { status: 201 });
});
