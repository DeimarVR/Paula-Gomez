import { Role } from '@prisma/client';
import { z } from 'zod';
import * as expediente from '@/server/modules/expediente/expediente.service';
import { body, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const notaSchema = z.object({
  texto: z.string().trim().min(3, 'Escribe la nota').max(8000),
  /** El día de la consulta, si la nota se escribe después. */
  fecha: z.string().datetime().nullable().optional(),
});

export const POST = route<{ params: { id: string } }>(async (req, { params }) => {
  const usuario = requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  const datos = await body(req, notaSchema);
  return expediente.agregarNota(
    params.id,
    { texto: datos.texto, fecha: datos.fecha ? new Date(datos.fecha) : null },
    usuario,
  );
});
