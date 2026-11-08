import * as ofertas from '@/server/modules/appointments/ofertas.service';
import { requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Recepción la mandó a mano por wa.me: queda marcada como enviada. */
export const PATCH = route<{ params: { id: string } }>(async (req, { params }) => {
  requireAuth(req);
  return ofertas.marcarInvitacionEnviada(params.id);
});
