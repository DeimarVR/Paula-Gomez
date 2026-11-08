import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { normalizePhone } from '@/server/lib/phone';
import { tokenDeEnlace } from '@/server/lib/tokens';
import { body, booleanoDeConsulta, query, requireAuth, route } from '@/server/http';
import { patientBodySchema } from './esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const listQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  active: booleanoDeConsulta.optional(),
  take: z.coerce.number().int().min(1).max(200).default(30),
  skip: z.coerce.number().int().min(0).default(0),
});

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, listQuerySchema);

  const where = {
    ...(q.active === undefined ? {} : { active: q.active }),
    ...(q.q
      ? {
          OR: [
            { fullName: { contains: q.q, mode: 'insensitive' as const } },
            { phone: { contains: q.q } },
            { documentId: { contains: q.q } },
            { email: { contains: q.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      include: {
        _count: { select: { plans: true, appointments: true } },
        plans: {
          where: { status: 'ACTIVO' },
          select: {
            id: true,
            title: true,
            totalSessions: true,
            _count: { select: { sessions: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: q.take,
      skip: q.skip,
    }),
    prisma.patient.count({ where }),
  ]);

  return { items, total, take: q.take, skip: q.skip };
});

export const POST = route(async (req) => {
  requireAuth(req);
  const datos = await body(req, patientBodySchema);

  const patient = await prisma.patient.create({
    data: {
      ...datos,
      // El enlace de seguimiento del paciente. Se pone a mano y no se deja al
      // valor por defecto de Prisma: ese enlace abre su historia sin pedir
      // contraseña, así que el token tiene que venir del generador seguro.
      publicToken: tokenDeEnlace(),
      phone: normalizePhone(datos.phone),
      email: datos.email?.toLowerCase() ?? null,
      birthDate: datos.birthDate ? new Date(datos.birthDate) : null,
    },
  });

  return NextResponse.json(patient, { status: 201 });
});
