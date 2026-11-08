import { importarCitasDelCalendario } from '@/server/services/importarCalendario';
import { requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Trae al sistema las citas anotadas a mano en Google Calendar.
 *
 * Existe además de la tarea diaria porque esperar al día siguiente no sirve:
 * cuando vuelve la señal, quien está en el mostrador quiere ver las citas en la
 * agenda ahora, no mañana. La tarea automática es la red de seguridad para el
 * día que nadie toque el botón.
 *
 * Es idempotente: cada cita creada guarda el identificador de su evento, así
 * que tocarlo diez veces seguidas no duplica nada.
 */
export const POST = route(async (req) => {
  requireAuth(req);
  return importarCitasDelCalendario();
});
