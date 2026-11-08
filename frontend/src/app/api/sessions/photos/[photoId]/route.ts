import { prisma } from '@/server/lib/prisma';
import { requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = route<{ params: { photoId: string } }>(async (req, { params }) => {
  requireAuth(req);
  await prisma.sessionPhoto.delete({ where: { id: params.photoId } });
  return { message: 'Foto eliminada' };
});
