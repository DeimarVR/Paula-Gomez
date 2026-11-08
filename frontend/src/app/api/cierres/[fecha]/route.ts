import { Role } from '@prisma/client';
import * as cierres from '@/server/modules/appointments/cierres.service';
import { requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Reabrir un día. Las citas que se cancelaron al cerrarlo no vuelven solas. */
export const DELETE = route<{ params: { fecha: string } }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN, Role.RECEPCION);
  return cierres.reabrirDia(params.fecha);
});
