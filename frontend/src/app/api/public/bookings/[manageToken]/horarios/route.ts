import { z } from 'zod';
import * as appointments from '@/server/modules/appointments/appointments.service';
import { query, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const consultaSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha esperado: AAAA-MM-DD')
    .optional(),
  days: z.coerce.number().int().min(1).max(31).default(14),
});

/** Los horarios que puede elegir quien cambia su cita desde el enlace. */
export const GET = route<{ params: { manageToken: string } }>(async (req, { params }) => {
  const q = query(req, consultaSchema);
  return appointments.horariosParaReagendar(params.manageToken, q.from, q.days);
});
