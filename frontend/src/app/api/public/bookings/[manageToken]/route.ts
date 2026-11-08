import * as appointments from '@/server/modules/appointments/appointments.service';
import { route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route<{ params: { manageToken: string } }>(async (_req, { params }) =>
  appointments.getByManageToken(params.manageToken),
);
