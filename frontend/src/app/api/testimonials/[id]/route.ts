import { Role } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = route<{ params: { id: string } }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  await prisma.testimonial.delete({ where: { id: params.id } });
  return { message: 'Testimonio eliminado' };
});
