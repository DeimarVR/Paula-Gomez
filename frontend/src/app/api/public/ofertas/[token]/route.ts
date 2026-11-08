import * as ofertas from '@/server/modules/appointments/ofertas.service';
import { route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lo que ve quien abre el enlace de un hueco ofrecido. */
export const GET = route<{ params: { token: string } }>(async (_req, { params }) =>
  ofertas.verOferta(params.token),
);
