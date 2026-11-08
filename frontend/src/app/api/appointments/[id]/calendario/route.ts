import { Role } from '@prisma/client';
import * as service from '@/server/modules/appointments/appointments.service';
import { requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Reintento manual de la sincronización con Google Calendar.
 *
 * Una cita se guarda aunque Google falle —la reserva importa más que la
 * agenda—, así que puede quedar sin evento sin que nadie se entere. Esto es lo
 * que permite arreglarlo desde el panel en vez de tener que crear la cita otra
 * vez.
 */
export const POST = route<{ params: { id: string } }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN, Role.RECEPCION);

  const { appointment, yaEstaba } = await service.sincronizarConCalendario(params.id);

  return {
    appointment,
    yaEstaba,
    message: yaEstaba ? 'Esta cita ya estaba en el calendario.' : 'Cita enviada al calendario.',
  };
});
