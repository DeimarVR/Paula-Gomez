import { z } from 'zod';
import * as appointments from '@/server/modules/appointments/appointments.service';
import { LIMITES, body, limitar, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reagendarSchema = z.object({ startsAt: z.string().datetime('Elija un horario válido') });

/**
 * El paciente elige otra hora desde su enlace.
 *
 * Con las reglas de la web: dos horas de margen, 60 días de tope y solo los
 * bloques que ofrece la agenda. Sirve tanto para cambiar una cita viva como
 * para elegir hora después de que la especialista cerró el día.
 */
export const POST = route<{ params: { manageToken: string } }>(async (req, { params }) => {
  limitar(req, 'reagendar', LIMITES.formulario);
  const { startsAt } = await body(req, reagendarSchema);
  return appointments.reagendarPorElPaciente(params.manageToken, new Date(startsAt));
});
