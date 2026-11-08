import { Role } from '@prisma/client';
import * as service from '@/server/modules/appointments/appointments.service';
import { requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cancelar desde el panel. Borra el evento de Google y ofrece el hueco. */
export const DELETE = route<{ params: { id: string } }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN, Role.RECEPCION);
  await service.cancelarCita(params.id, { motivo: 'Cancelada desde el panel', origen: 'panel' });
  return { message: 'Cita cancelada' };
});
