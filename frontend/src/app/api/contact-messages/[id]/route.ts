import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { body, requireAuth, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const atenderSchema = z.object({ handled: z.boolean() });

/**
 * Marcar un mensaje como atendido, o devolverlo a la bandeja.
 *
 * Se puede deshacer a propósito: marcar por error es tan fácil como tocar el
 * botón equivocado, y un mensaje de un paciente que desaparece sin vuelta atrás
 * es exactamente lo que esta pantalla vino a evitar.
 */
export const PATCH = route<{ params: { id: string } }>(async (req, { params }) => {
  requireAuth(req);
  const { handled } = await body(req, atenderSchema);

  return prisma.contactMessage.update({
    where: { id: params.id },
    data: { handled },
  });
});

/**
 * Borrar un mensaje, sin vuelta atrás.
 *
 * Existe por la publicidad. Un formulario público en internet recibe ofertas de
 * servicios y correos automáticos, y esa basura no se «atiende»: se tira. Sin
 * esto, la única salida era marcarla como atendida y dejarla acumulándose entre
 * las consultas de verdad.
 *
 * Solo ADMIN, como el resto de los borrados del sistema: cualquiera con sesión
 * puede trabajar, deshacer es de quien administra. Y porque la diferencia entre
 * publicidad y una paciente escribiendo raro no siempre es obvia.
 */
export const DELETE = route<{ params: { id: string } }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);

  await prisma.contactMessage.delete({ where: { id: params.id } });
  return { ok: true };
});
