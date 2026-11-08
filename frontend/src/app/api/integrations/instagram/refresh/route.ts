import { Role } from '@prisma/client';
import * as instagram from '@/server/services/instagram';
import { requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Fuerza la renovación del token sin esperar a la tarea programada. */
export const POST = route(async (req) => {
  requireRole(req, Role.ADMIN);
  return instagram.refreshAccessToken(true);
});
