import { AppointmentStatus } from '@prisma/client';
import { z } from 'zod';
import * as service from '@/server/modules/appointments/appointments.service';
import { body, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statusSchema = z.object({ status: z.nativeEnum(AppointmentStatus) });

/**
 * Cambiar el estado de una cita.
 *
 * Pasa por el servicio y no escribe directo: cancelar tiene que borrar el
 * evento de Google y ofrecer el hueco, y revivir una cita tiene que mirar que
 * su hora siga libre. Ver `cambiarEstado`.
 */
export const PATCH = route<{ params: { id: string } }>(async (req, { params }) => {
  requireAuth(req);
  const { status } = await body(req, statusSchema);
  return service.cambiarEstado(params.id, status);
});
