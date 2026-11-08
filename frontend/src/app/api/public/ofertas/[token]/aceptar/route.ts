import * as ofertas from '@/server/modules/appointments/ofertas.service';
import { LIMITES, limitar, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Tomar el hueco. El primero que llega se lo queda; a los demás se les dice que ya fue tomado. */
export const POST = route<{ params: { token: string } }>(async (req, { params }) => {
  limitar(req, 'oferta', LIMITES.formulario);
  return ofertas.aceptarOferta(params.token);
});
