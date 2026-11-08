import { z } from 'zod';
import { Role } from '@prisma/client';
import { body, requireRole, route } from '@/server/http';
import {
  comoSeLoDigo,
  generarIdeas,
  generarTexto,
  ideasSchema,
  textoSchema,
} from '@/server/modules/asistente/contenido.service';
import { devolver, reservar } from '@/server/modules/asistente/gasto';
import { HttpError } from '@/server/lib/httpError';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const peticionSchema = z.discriminatedUnion('que', [
  z.object({ que: z.literal('texto') }).merge(textoSchema),
  z.object({ que: z.literal('ideas') }).merge(ideasSchema),
]);

/**
 * Redactar con la IA.
 *
 * Solo ADMIN y PROFESIONAL: estos textos acaban en la página pública o en un
 * mensaje a un paciente, y eso es voz del centro. Recepción escribe en el
 * sistema todo el día, pero no decide cómo le habla la clínica a la gente.
 */
export const POST = route(async (req) => {
  requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  const peticion = await body(req, peticionSchema);

  if (!(await reservar(1))) {
    throw HttpError.unprocessable('Se alcanzó el tope de uso de la IA por hoy.');
  }

  try {
    if (peticion.que === 'ideas') {
      return { ideas: await generarIdeas(peticion.tema, peticion.cantidad) };
    }
    return { texto: await generarTexto(peticion) };
  } catch (fallo) {
    await devolver(1);
    throw comoSeLoDigo(fallo);
  }
});
