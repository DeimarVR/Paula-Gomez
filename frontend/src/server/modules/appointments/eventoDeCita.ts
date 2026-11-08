import type { Appointment } from '@prisma/client';
import { CITA } from '@/lib/agenda';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import * as calendar from '../../services/googleCalendar';

/**
 * Lo que comparten las citas, las ofertas y los cierres al hablar con Google.
 *
 * Vive aparte para que los tres servicios lo usen sin importarse entre sí: el
 * de citas llama al de ofertas cuando se libera un hueco, y si el de ofertas
 * tuviera que importar al de citas para mover un evento, se morderían la cola.
 */

type DatosDeCita = Pick<
  Appointment,
  'contactName' | 'contactPhone' | 'contactEmail' | 'message' | 'startsAt' | 'endsAt'
>;

/**
 * El evento tal y como se ve en la agenda de Google.
 *
 * Un solo sitio para el texto: lo usan el alta, el reintento manual desde el
 * panel y las citas que vuelven a la agenda tras un día cerrado. Si cada uno
 * armara el suyo, el día que cambie el texto cambiaría en uno solo.
 */
export function datosDelEvento(cita: DatosDeCita): calendar.CalendarEventInput {
  return {
    summary: `${CITA.nombre} — ${cita.contactName}`,
    description: [
      `Paciente: ${cita.contactName}`,
      `Teléfono: ${cita.contactPhone}`,
      cita.contactEmail ? `Correo: ${cita.contactEmail}` : null,
      `${CITA.nombre} (${CITA.duracionMin} min)`,
      cita.message ? `Nota: ${cita.message}` : null,
      '',
      `Agendada desde ${env.PUBLIC_WEB_URL}`,
    ]
      .filter(Boolean)
      .join('\n'),
    startsAt: cita.startsAt,
    endsAt: cita.endsAt,
    attendeeEmail: cita.contactEmail,
    attendeeName: cita.contactName,
  };
}

/**
 * Deja el evento de Google donde ahora está la cita.
 *
 * Si la cita ya tenía evento, se mueve; si no lo tenía —estaba cancelada, o
 * Google no respondió al crearla— se crea uno nuevo y se guarda su
 * identificador. Nunca lanza: la cita ya está movida en la base, que es lo
 * que no se puede perder, y Google se puede reintentar desde el panel.
 */
export async function ponerEnGoogle(cita: Appointment): Promise<void> {
  if (cita.googleEventId) {
    await calendar.updateEvent(cita.googleEventId, {
      startsAt: cita.startsAt,
      endsAt: cita.endsAt,
      transparente: true,
    });
    return;
  }

  const creado = await calendar.createEvent(datosDelEvento(cita));
  if (creado) {
    await prisma.appointment.update({
      where: { id: cita.id },
      data: { googleEventId: creado.eventId, googleHtmlLink: creado.htmlLink },
    });
  }
}

/** Añade una línea a la nota de la cita sin perder lo que ya decía. */
export function conNota(nota: string | null, etiqueta: string, texto?: string | null): string | null {
  if (!texto?.trim()) return nota;
  return `${nota ?? ''}\n[${etiqueta}] ${texto.trim()}`.trim();
}

/** Un teléfono al que se le puede escribir. Las citas importadas a veces no traen. */
export function telefonoUsable(telefono: string | null | undefined): telefono is string {
  return (telefono ?? '').replace(/\D/g, '').length >= 10;
}

export const enlaceDeCita = (manageToken: string) => `${env.PUBLIC_WEB_URL}/cita/${manageToken}`;
export const enlaceDeOferta = (token: string) => `${env.PUBLIC_WEB_URL}/oferta/${token}`;
