import { z } from 'zod';
import { CITA } from '@/lib/agenda';
import { env } from '@/server/config/env';
import { toZonedDateKey } from '@/server/lib/datetime';
import { MAX_ADVANCE_DAYS, getAvailability } from '@/server/services/availability';
import { query, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La misma disponibilidad que ve el paciente, pero para el panel.
 *
 * Sin los márgenes de la web —la cita de dentro de una hora y el control a
 * tres meses se pueden agendar— y con `excluir` para reagendar: la cita que se
 * mueve no cuenta como ocupado en su propia hora. El cálculo es el mismo: un
 * bloque agendado desde aquí compite con una reserva de la web.
 */
const consultaSchema = z.object({
  /** Ya no se usa: hay un solo tipo de cita. Se acepta para no romper llamadas viejas. */
  serviceId: z.string().optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha esperado: AAAA-MM-DD')
    .optional(),
  days: z.coerce.number().int().min(1).max(31).default(1),
  excluir: z.string().min(1).optional(),
});

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, consultaSchema);

  return {
    cita: { nombre: CITA.nombre, duracionMin: CITA.duracionMin },
    timezone: env.CLINIC_TIMEZONE,
    maxAdvanceDays: MAX_ADVANCE_DAYS,
    days: await getAvailability({
      fromDate: q.from ?? toZonedDateKey(new Date(), env.CLINIC_TIMEZONE),
      days: q.days,
      desdeElPanel: true,
      excluirCitaId: q.excluir,
    }),
  };
});
