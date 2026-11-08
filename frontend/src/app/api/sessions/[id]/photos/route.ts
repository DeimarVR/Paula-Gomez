import { NextResponse } from 'next/server';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { body, requireAuth, route } from '@/server/http';
import { photoSchema } from '../../esquemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route<{ params: { id: string } }>(async (req, { params }) => {
  requireAuth(req);
  const datos = await body(req, photoSchema);

  const session = await prisma.treatmentSession.findUnique({ where: { id: params.id } });
  if (!session) throw HttpError.notFound('Sesión no encontrada');

  const photo = await prisma.sessionPhoto.create({
    data: { sessionId: session.id, ...datos },
  });

  return NextResponse.json(photo, { status: 201 });
});
