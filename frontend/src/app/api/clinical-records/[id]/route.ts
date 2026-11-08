import { Role } from '@prisma/client';
import { body, requireAuth, requireRole, route } from '@/server/http';
import {
  actualizar,
  eliminar,
  obtener,
  sincronizarProximosControles,
} from '@/server/modules/clinical/clinical.service';
import { fichaSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export const GET = route<Ctx>(async (req, { params }) => {
  requireAuth(req);
  return obtener(params.id);
});

export const PUT = route<Ctx>(async (req, { params }) => {
  requireAuth(req);
  const datos = await body(req, fichaSchema);
  const ficha = await actualizar(params.id, datos);
  const avisos = await sincronizarProximosControles(ficha.id);
  return { ...ficha, avisos };
});

/** Borrar historia clínica es definitivo: solo ADMIN. */
export const DELETE = route<Ctx>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  await eliminar(params.id);
  return { message: 'Ficha eliminada' };
});
