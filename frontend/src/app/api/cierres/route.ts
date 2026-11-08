import { Role } from '@prisma/client';
import { z } from 'zod';
import * as cierres from '@/server/modules/appointments/cierres.service';
import { body, requireAuth, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Días cerrados de hoy en adelante y las disculpas pendientes. */
export const GET = route(async (req) => {
  requireAuth(req);
  return cierres.estadoDeCierres();
});

const cerrarSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige un día'),
  motivo: z.string().trim().max(200).optional().nullable(),
});

/**
 * Cerrar un día completo.
 *
 * Admin y recepción: lo decide la especialista, pero muchas veces quien pulsa
 * el botón es recepción porque ella está atendiendo.
 */
export const POST = route(async (req) => {
  requireRole(req, Role.ADMIN, Role.RECEPCION);
  const { fecha, motivo } = await body(req, cerrarSchema);
  return cierres.cerrarDia(fecha, { motivo });
});
