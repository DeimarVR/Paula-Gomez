import { z } from 'zod';
import * as avisos from '@/server/services/avisos';
import { body, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lo que hay que mirar hoy, en una sola pregunta.
 *
 * Existe porque los avisos del inventario solo se veían entrando a Inventario,
 * y a Inventario se entra cuando ya se necesita algo — que es justo tarde. Un
 * producto agotado no avisa: se descubre con el paciente en la silla.
 *
 * Cada aviso trae su texto ya escrito y el sitio donde se arregla, así que la
 * campana no tiene que saber nada del inventario para dibujarlos. El día que
 * haya avisos de otra cosa —una caja sin cerrar, un consentimiento sin firmar—
 * se añaden en el servicio y la campana no cambia.
 */
export const GET = route(async (req) => {
  const sesion = requireAuth(req);
  return avisos.avisosDe(sesion.sub);
});

const vistosSchema = z.object({
  /**
   * Qué se marca. Sin esto, todo lo que hay ahora.
   *
   * Se manda desde el navegador y NO se comprueba contra nada: no hace falta.
   * Marcar como visto algo que no existe no cambia nada —al guardar se filtra
   * contra lo que hay hoy— y lo peor que puede pasar es que alguien esconda
   * sus propios avisos, que es justo lo que el botón hace de todos modos.
   */
  claves: z.array(z.string().trim().min(1).max(120)).max(500).optional(),
});

/** Marca avisos como vistos y devuelve cómo queda la campana. */
export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const datos = await body(req, vistosSchema);
  return avisos.marcarVistos(sesion.sub, datos.claves);
});
