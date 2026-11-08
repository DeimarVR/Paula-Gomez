import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { addDays } from '@/server/lib/datetime';
import { body, query, requireAuth, route } from '@/server/http';
import { agendaQuerySchema, sessionCreateSchema } from './esquemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Agenda del día / semana para el equipo. */
export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, agendaQuerySchema);

  const from = q.from ? new Date(q.from) : new Date();
  const to = q.to ? new Date(q.to) : addDays(from, 7);

  const sessions = await prisma.treatmentSession.findMany({
    where: {
      scheduledAt: { gte: from, lte: to },
      ...(q.status ? { status: q.status } : {}),
    },
    include: {
      plan: {
        include: {
          patient: { select: { id: true, fullName: true, phone: true } },
          service: { select: { name: true } },
        },
      },
      photos: { select: { id: true, url: true, type: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  return { items: sessions, from, to };
});

export const POST = route(async (req) => {
  requireAuth(req);
  const datos = await body(req, sessionCreateSchema);

  const plan = await prisma.treatmentPlan.findUnique({ where: { id: datos.planId } });
  if (!plan) throw HttpError.notFound('Plan de tratamiento no encontrado');

  const last = await prisma.treatmentSession.findFirst({
    where: { planId: plan.id },
    orderBy: { sessionNumber: 'desc' },
    select: { sessionNumber: true },
  });

  const session = await prisma.treatmentSession.create({
    data: {
      planId: plan.id,
      sessionNumber: datos.sessionNumber ?? (last?.sessionNumber ?? 0) + 1,
      scheduledAt: new Date(datos.scheduledAt),
    },
  });

  return NextResponse.json(session, { status: 201 });
});
