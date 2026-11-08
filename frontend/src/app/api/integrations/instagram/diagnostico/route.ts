import { Role } from '@prisma/client';
import * as instagram from '@/server/services/instagram';
import { requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * A qué cuenta pertenece el token y qué ve.
 *
 * Es ADMIN y no devuelve el token: solo el identificador y el nombre de la
 * cuenta, el número de publicaciones y, si algo falla, el mensaje de Meta tal
 * cual. Sin esto, «no salen las publicaciones» se responde adivinando.
 */
export const GET = route(async (req) => {
  requireRole(req, Role.ADMIN);
  return instagram.diagnosticar();
});
