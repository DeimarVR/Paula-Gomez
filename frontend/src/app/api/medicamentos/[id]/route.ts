import { Role } from '@prisma/client';
import { z } from 'zod';
import * as expediente from '@/server/modules/expediente/expediente.service';
import { body, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

const cambioSchema = z.object({
  nombre: z.string().trim().min(2).max(200).optional(),
  dosis: z.string().trim().max(300).nullable().optional(),
  notas: z.string().trim().max(1000).nullable().optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  /** false = suspendido. Queda en la historia con la fecha en que se dejó. */
  activo: z.boolean().optional(),
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const usuario = requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  const { desde, ...resto } = await body(req, cambioSchema);
  return expediente.editarMedicamento(
    params.id,
    {
      ...resto,
      ...(desde !== undefined ? { desde: desde ? new Date(`${desde}T12:00:00Z`) : null } : {}),
    },
    usuario,
  );
});

/** Para lo que se anotó por error. Lo que dejó de tomar se suspende, no se borra. */
export const DELETE = route<Ctx>(async (req, { params }) => {
  requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  return expediente.borrarMedicamento(params.id);
});
