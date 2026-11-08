import { Role } from '@prisma/client';
import { z } from 'zod';
import * as expediente from '@/server/modules/expediente/expediente.service';
import { body, requireAuth, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

const cambioSchema = z.object({
  titulo: z.string().trim().min(2).max(120).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notas: z.string().trim().max(1000).nullable().optional(),
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  requireAuth(req);
  const { fecha, ...resto } = await body(req, cambioSchema);
  return expediente.editarHoja(params.id, {
    ...resto,
    ...(fecha !== undefined ? { fecha: fecha ? new Date(`${fecha}T12:00:00Z`) : null } : {}),
  });
});

/** Borrar una hoja borra también el archivo. Solo administración. */
export const DELETE = route<Ctx>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  return expediente.borrarHoja(params.id);
});
