import * as cierres from '@/server/modules/appointments/cierres.service';
import { requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** La disculpa se mandó a mano por wa.me: deja de estar pendiente. */
export const PATCH = route<{ params: { id: string } }>(async (req, { params }) => {
  requireAuth(req);
  return cierres.marcarAvisoEnviado(params.id);
});
