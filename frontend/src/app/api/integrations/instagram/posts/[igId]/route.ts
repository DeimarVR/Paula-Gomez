import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { body, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hideSchema = z.object({ hidden: z.boolean() });

/** Oculta una publicación puntual del feed de la web. */
export const PATCH = route<{ params: { igId: string } }>(async (req, { params }) => {
  requireAuth(req);
  const { hidden } = await body(req, hideSchema);
  return prisma.instagramPost.update({ where: { igId: params.igId }, data: { hidden } });
});
