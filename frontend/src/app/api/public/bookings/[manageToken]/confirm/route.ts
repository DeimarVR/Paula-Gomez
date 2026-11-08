import * as appointments from '@/server/modules/appointments/appointments.service';
import { route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = route<{ params: { manageToken: string } }>(async (_req, { params }) => {
  const appointment = await appointments.confirmByToken(params.manageToken);
  return { message: 'Cita confirmada', status: appointment.status };
});
