import { Role } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import * as horario from '@/server/modules/appointments/horario.service';
import { body, requireAuth, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAuth(req);
  return horario.leerHorario();
});

const hora = z.string().regex(/^\d{2}:\d{2}$/, 'Escribe la hora como 08:00');

const horarioSchema = z.object({
  dias: z
    .array(
      z.object({
        dia: z.number().int().min(0).max(6),
        activo: z.boolean(),
        apertura: hora,
        cierre: hora,
        pausaInicio: hora.nullable().optional(),
        pausaFin: hora.nullable().optional(),
      }),
    )
    .length(7, 'Hacen falta los siete días'),
});

/** Solo administración: cambiar el horario mueve todos los bloques de la agenda. */
export const PUT = route(async (req) => {
  requireRole(req, Role.ADMIN);
  const { dias } = await body(req, horarioSchema);
  const resultado = await horario.guardarHorario(
    dias.map((d) => ({ ...d, pausaInicio: d.pausaInicio ?? null, pausaFin: d.pausaFin ?? null })),
  );
  // El horario sale en el pie y en Contacto de todas las páginas públicas.
  revalidatePath('/', 'layout');
  return resultado;
});
