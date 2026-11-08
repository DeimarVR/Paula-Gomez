import * as ofertas from '@/server/modules/appointments/ofertas.service';
import { requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Los huecos ofrecidos de la última semana y los que siguen abiertos. */
export const GET = route(async (req) => {
  requireAuth(req);
  return { items: await ofertas.listarOfertas() };
});
