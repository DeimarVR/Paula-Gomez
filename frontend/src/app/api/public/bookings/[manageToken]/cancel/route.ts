import { z } from 'zod';
import * as appointments from '@/server/modules/appointments/appointments.service';
import { LIMITES, body, limitar, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cancelSchema = z.object({ reason: z.string().trim().max(300).optional() });

export const POST = route<{ params: { manageToken: string } }>(async (req, { params }) => {
  limitar(req, 'cancelacion', LIMITES.formulario);
  const { reason } = await body(req, cancelSchema);

  const appointment = await appointments.cancelByToken(params.manageToken, reason);
  return { message: 'Cita cancelada', status: appointment.status };
});
