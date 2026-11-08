import { z } from 'zod';
import * as expediente from '@/server/modules/expediente/expediente.service';
import { body, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hojasSchema = z.object({
  hojas: z
    .array(
      z.object({
        titulo: z.string().trim().min(2, 'Ponle un nombre a la hoja').max(120),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
        ruta: z.string().startsWith('/api/archivos/expedientes/'),
        tipo: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf']),
        notas: z.string().trim().max(1000).nullable().optional(),
      }),
    )
    .min(1)
    .max(20),
});

/**
 * Registrar hojas ya subidas.
 *
 * Cualquiera del equipo: muchas veces quien fotografía la hoja es recepción,
 * al final de la consulta.
 */
export const POST = route<{ params: { id: string } }>(async (req, { params }) => {
  const usuario = requireAuth(req);
  const { hojas } = await body(req, hojasSchema);
  return {
    items: await expediente.agregarHojas(
      params.id,
      hojas.map((h) => ({ ...h, fecha: h.fecha ? new Date(`${h.fecha}T12:00:00Z`) : null })),
      usuario,
    ),
  };
});
