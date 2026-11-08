import { NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { body, requireAuth, requireRole, route } from '@/server/http';
import { serviceSchema } from './esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAuth(req);
  return {
    items: await prisma.service.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { plans: true, appointments: true } } },
    }),
  };
});

export const POST = route(async (req) => {
  requireRole(req, Role.ADMIN);
  const datos = await body(req, serviceSchema);
  return NextResponse.json(await prisma.service.create({ data: datos }), { status: 201 });
});
