import { AppointmentStatus } from '@prisma/client';
import { prisma } from './lib/prisma';
import { createLogger } from './lib/logger';
import { ventanaDeManana } from './lib/datetime';
import { env } from './config/env';
import { refreshAccessToken, syncPosts } from './services/instagram';
import { sendAppointmentReminder } from './services/whatsapp';
import { importarSiSePuede } from './services/importarCalendario';
import { vencerOfertas } from './modules/appointments/ofertas.service';

const log = createLogger('cron');

/**
 * Renovación del token de Instagram.
 *
 * Este es el trabajo que evita que el feed "se caiga" cada 60 días. La función
 * decide sola si toca renovar, así que correrla a diario es barato y seguro.
 */
export async function runInstagramTokenRefresh(): Promise<string> {
  const result = await refreshAccessToken();
  return result.refreshed
    ? `token renovado hasta ${result.expiresAt?.toISOString()}`
    : `token sin cambios: ${result.reason}`;
}

export async function runInstagramSync(): Promise<string> {
  const result = await syncPosts(12);
  return result.message;
}

/**
 * Recordatorio por WhatsApp a los pacientes con cita al día siguiente.
 *
 * Es idempotente por diseño: solo toma las citas con `whatsappReminderSentAt`
 * en nulo y sella la marca al enviar. Vercel avisa de que una tarea puede
 * ejecutarse dos veces o ninguna, así que esto importa: si se repite, no
 * duplica mensajes; si se salta un día, al siguiente recupera lo pendiente.
 */
export async function runAppointmentReminders(): Promise<string> {
  // El día de mañana en el calendario de la clínica. NO «dentro de 24 horas»:
  // ver `ventanaDeManana`, que es la misma que usa la pantalla del panel.
  const { desde, hasta } = ventanaDeManana(env.CLINIC_TIMEZONE);
  const appointments = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: desde, lt: hasta },
      status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] },
      whatsappReminderSentAt: null,
    },
    include: { service: true },
  });

  if (appointments.length === 0) return 'sin recordatorios pendientes';

  let sent = 0;
  for (const appointment of appointments) {
    const result = await sendAppointmentReminder({
      contactName: appointment.contactName,
      contactPhone: appointment.contactPhone,
      serviceName: appointment.service.name,
      startsAt: appointment.startsAt,
      manageToken: appointment.manageToken,
    });

    if (result.sent) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { whatsappReminderSentAt: new Date() },
      });
      sent += 1;
    }
  }

  return `recordatorios enviados: ${sent}/${appointments.length}`;
}

/**
 * Las tareas, en una sola pasada diaria.
 *
 * Van juntas porque el plan Hobby de Vercel solo admite una ejecución al día
 * por tarea y un número muy corto de tareas; separarlas en tres no cabría.
 * En Pro se pueden partir y darle al feed una cadencia horaria como tenía con
 * node-cron.
 *
 * Cada tarea se aísla: que Instagram falle no puede impedir que salgan los
 * recordatorios de las citas de mañana.
 */
export async function runDailyJobs(): Promise<Record<string, string>> {
  const salida: Record<string, string> = {};

  for (const [nombre, tarea] of [
    ['instagramToken', runInstagramTokenRefresh],
    ['instagramSync', runInstagramSync],
    // Va ANTES de los recordatorios a propósito: una cita anotada ayer en el
    // calendario sin señal tiene que existir en el sistema antes de que se
    // decida a quién avisarle mañana.
    ['importarCalendario', importarSiSePuede],
    ['recordatorios', runAppointmentReminders],
    // Limpieza: los huecos ofrecidos que ya no se pueden tomar dejan de verse
    // como abiertos en el panel. Se evalúan igual al abrir cada enlace, así que
    // si esto falla un día no pasa nada.
    ['ofertas', vencerOfertas],
  ] as const) {
    try {
      salida[nombre] = await tarea();
    } catch (error) {
      log.error(`La tarea "${nombre}" falló`, error);
      salida[nombre] = `error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return salida;
}
