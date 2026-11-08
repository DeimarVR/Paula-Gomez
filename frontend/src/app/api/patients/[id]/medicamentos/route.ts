import { Role } from '@prisma/client';
import { z } from 'zod';
import * as expediente from '@/server/modules/expediente/expediente.service';
import { body, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const medicamentoSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el medicamento').max(200),
  dosis: z.string().trim().max(300).nullable().optional(),
  notas: z.string().trim().max(1000).nullable().optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const POST = route<{ params: { id: string } }>(async (req, { params }) => {
  const usuario = requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  const datos = await body(req, medicamentoSchema);
  return expediente.agregarMedicamento(
    params.id,
    { ...datos, desde: datos.desde ? new Date(`${datos.desde}T12:00:00Z`) : null },
    usuario,
  );
});
