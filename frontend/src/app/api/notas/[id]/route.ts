import { Role } from '@prisma/client';
import { z } from 'zod';
import * as expediente from '@/server/modules/expediente/expediente.service';
import { body, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

const cambioSchema = z.object({
  texto: z.string().trim().min(3).max(8000).optional(),
  fecha: z.string().datetime().nullable().optional(),
});

/** Solo quien la escribió, o administración: ver `editarNota`. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const usuario = requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  const datos = await body(req, cambioSchema);
  return expediente.editarNota(
    params.id,
    { texto: datos.texto, fecha: datos.fecha ? new Date(datos.fecha) : null },
    usuario,
  );
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  const usuario = requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  return expediente.borrarNota(params.id, usuario);
});
