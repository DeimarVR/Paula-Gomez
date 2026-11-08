import { body, requireAuth, route } from '@/server/http';
import { responder } from '@/server/modules/asistente/agente.service';
import { comoVaElGasto, devolver, reservar } from '@/server/modules/asistente/gasto';
import { iaDisponible } from '@/server/modules/asistente/groq';
import { peticionSchema } from '@/server/modules/asistente/tipos';
import { POR_NOMBRE } from '@/server/modules/asistente/herramientas';
import { HttpError } from '@/server/lib/httpError';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El chat del panel.
 *
 * Cualquiera con sesión puede escribirle; lo que cambia según el rol es qué
 * herramientas se le ofrecen al modelo. Los permisos de verdad siguen donde
 * siempre: en las rutas que ejecutan cada acción. Esta ruta no crea nada.
 */
export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const peticion = await body(req, peticionSchema);

  /*
   * Confirmar una acción de escritura no vuelve a pasar por el modelo.
   *
   * La persona ya vio el resumen y dijo que sí; preguntarle otra vez a Groq
   * sería gastar una llamada para que reconstruya algo que ya está decidido, y
   * abriría la puerta a que esta vez conteste otra cosa. Se valida contra la
   * misma herramienta y se devuelve la acción tal cual.
   */
  if (peticion.confirmar) {
    const herramienta = POR_NOMBRE.get(peticion.confirmar.type);
    if (!herramienta || herramienta.riesgo !== 'escribir') {
      throw HttpError.badRequest('Esa acción no se confirma por aquí');
    }
    if (herramienta.roles && !herramienta.roles.includes(sesion.role as never)) {
      throw HttpError.forbidden('Tu rol no puede hacer eso');
    }

    const validado = herramienta.esquema.safeParse(peticion.confirmar.params);
    if (!validado.success) throw HttpError.badRequest('Faltan datos para esa acción');

    return {
      reply: 'Hecho.',
      action: { type: herramienta.name, ...(validado.data as Record<string, unknown>), confirmada: true },
      origen: 'reglas' as const,
    };
  }

  const salida = await responder(peticion, {
    rol: sesion.role,
    reservarCupo: () => reservar(1),
    devolverCupo: () => devolver(1),
  });

  return salida;
});

/** Si el chat está disponible y cómo va el cupo. Lo pregunta el panel al abrir. */
export const GET = route(async (req) => {
  requireAuth(req);
  return { ia: iaDisponible(), gasto: await comoVaElGasto() };
});
