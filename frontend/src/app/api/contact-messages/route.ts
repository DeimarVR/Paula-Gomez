import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { booleanoDeConsulta, query, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Los mensajes del formulario de contacto de la web.
 *
 * Se guardaban desde el primer día y no había ninguna pantalla que los
 * mostrara: entraban en la base y ahí se quedaban. Mientras tanto la web le
 * decía al visitante «te respondemos dentro del horario de atención», una
 * promesa que nadie podía cumplir porque nadie los veía.
 */
const consultaSchema = z.object({
  /** `false` trae solo los que faltan por atender, que es lo normal. */
  handled: booleanoDeConsulta.optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, consultaSchema);

  const where = q.handled === undefined ? {} : { handled: q.handled };

  const [items, total, sinAtender] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: q.take,
    }),
    prisma.contactMessage.count({ where }),
    // Siempre el total pendiente, filtre lo que filtre: es el número del
    // contador del menú, y tiene que decir lo mismo en todas las pantallas.
    prisma.contactMessage.count({ where: { handled: false } }),
  ]);

  return { items, total, sinAtender };
});
