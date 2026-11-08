import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { body, requireAuth, route } from '@/server/http';
import { planUpdateSchema } from '../../esquemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { planId: string } };

export const GET = route<Ctx>(async (req, { params }) => {
  requireAuth(req);

  const plan = await prisma.treatmentPlan.findUnique({
    where: { id: params.planId },
    include: {
      patient: { select: { id: true, fullName: true, phone: true, publicToken: true } },
      service: { select: { id: true, name: true, slug: true } },
      sessions: {
        include: { photos: true, professional: { select: { id: true, fullName: true } } },
        orderBy: { sessionNumber: 'asc' },
      },
    },
  });

  if (!plan) throw HttpError.notFound('Plan de tratamiento no encontrado');
  return plan;
});

export const PUT = route<Ctx>(async (req, { params }) => {
  requireAuth(req);
  const datos = await body(req, planUpdateSchema);
  return prisma.treatmentPlan.update({ where: { id: params.planId }, data: datos });
});
