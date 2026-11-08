import * as ofertas from '@/server/modules/appointments/ofertas.service';
import { LIMITES, limitar, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** «No me interesa». Su cita queda como estaba. */
export const POST = route<{ params: { token: string } }>(async (req, { params }) => {
  limitar(req, 'oferta', LIMITES.formulario);
  return ofertas.rechazarOferta(params.token);
});
