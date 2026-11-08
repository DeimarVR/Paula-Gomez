import { Role } from '@prisma/client';
import { env } from '@/server/config/env';
import * as googleCalendar from '@/server/services/googleCalendar';
import { requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Qué calendarios ve la cuenta de Google que está conectada.
 *
 * Existe por un fallo concreto y difícil de leer: la integración decía
 * «Conectado», las citas se guardaban bien, y en Google no aparecía ninguna. El
 * error que devolvía la API era «Not Found» a secas, que no señala a nada.
 *
 * La causa es siempre la misma familia: `GOOGLE_CALENDAR_ID` apunta a un
 * calendario que la cuenta conectada no puede tocar —lo creó otra cuenta, o
 * está compartido solo de lectura—. Esta ruta pone la lista delante para poder
 * comparar en vez de adivinar.
 */
export const GET = route(async (req) => {
  requireRole(req, Role.ADMIN);

  const calendarios = await googleCalendar.listarCalendarios();

  return {
    calendarIdEnUso: env.GOOGLE_CALENDAR_ID,
    /** Lo que decide si esto funciona: que el configurado esté y sea escribible. */
    accesible: calendarios.some((c) => c.enUso && c.escribible),
    calendarios,
  };
});
