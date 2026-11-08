import { z } from 'zod';
import * as service from '@/server/modules/appointments/appointments.service';
import { body, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const rescheduleSchema = z.object({ startsAt: z.string().datetime() });

/**
 * Reprogramar desde el panel.
 *
 * `desdeElPanel: true` no es un adorno: esta ruta exige sesión, así que quien
 * la usa trabaja en el centro y tiene al paciente delante. Sin la marca, mover
 * una cita se juzgaba con las reglas del formulario público —dos horas de
 * anticipación, tope de 60 días— y la recepción recibía «ese horario ya está
 * muy próximo» sobre un hueco que la propia pantalla acababa de ofrecerle
 * como libre. El alta y los controles ya la pasaban; reprogramar se quedó sin
 * ella, y las dos capas opinaban distinto sobre el mismo hueco.
 *
 * El cruce con otra cita se sigue comprobando igual: eso no lo salta nadie.
 * La hora que deja libre se ofrece a quienes tienen cita más adelante.
 */
export const PATCH = route<{ params: { id: string } }>(async (req, { params }) => {
  requireAuth(req);
  const { startsAt } = await body(req, rescheduleSchema);
  return service.reschedule(params.id, new Date(startsAt), { desdeElPanel: true, origen: 'panel' });
});
