import { Role } from '@prisma/client';
import * as facial from '@/server/modules/facial/facial.service';
import { HttpError } from '@/server/lib/httpError';
import { body, requireAuth, requireRole, route } from '@/server/http';
import { aEntrada, fichaFacialSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req, { params }: { params: { id: string } }) => {
  requireAuth(req);
  const ficha = await facial.obtener(params.id);
  if (!ficha) throw HttpError.notFound('Ficha no encontrada');
  return ficha;
});

export const PUT = route(async (req, { params }: { params: { id: string } }) => {
  requireAuth(req);
  return facial.actualizar(params.id, aEntrada(await body(req, fichaFacialSchema)));
});

/** Borrar una ficha clínica es cosa del administrador, y solo suya. */
export const DELETE = route(async (req, { params }: { params: { id: string } }) => {
  requireRole(req, Role.ADMIN);
  return facial.borrar(params.id);
});
