import { Role } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { body, requireRole, route } from '@/server/http';
import { serviceSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export const PUT = route<Ctx>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  const datos = await body(req, serviceSchema.partial());
  return prisma.service.update({ where: { id: params.id }, data: datos });
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  // Se desactiva en lugar de borrar: hay citas y planes que lo referencian.
  await prisma.service.update({ where: { id: params.id }, data: { active: false } });
  return { message: 'Tratamiento desactivado' };
});
