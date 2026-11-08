import { z } from 'zod';
import { CITA } from '@/lib/agenda';
import { env } from '@/server/config/env';
import { toZonedDateKey } from '@/server/lib/datetime';
import { MAX_ADVANCE_DAYS, getAvailability } from '@/server/services/availability';
import { query, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Los horarios libres para la web.
 *
 * Ya no se pide por tratamiento: hay un solo tipo de cita. `serviceId` se sigue
 * aceptando y se ignora, para que un enlace viejo o una pestaña abierta desde
 * antes del cambio no reciban un error.
 */
const availabilitySchema = z.object({
  serviceId: z.string().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha esperado: AAAA-MM-DD')
    .optional(),
  days: z.coerce.number().int().min(1).max(31).default(14),
});

export const GET = route(async (req) => {
  const q = query(req, availabilitySchema);

  return {
    cita: { nombre: CITA.nombre, duracionMin: CITA.duracionMin },
    timezone: env.CLINIC_TIMEZONE,
    maxAdvanceDays: MAX_ADVANCE_DAYS,
    days: await getAvailability({
      fromDate: q.from ?? toZonedDateKey(new Date(), env.CLINIC_TIMEZONE),
      days: q.days,
    }),
  };
});
