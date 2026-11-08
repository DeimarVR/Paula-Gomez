import { AppointmentStatus } from '@prisma/client';
import { env } from '@/server/config/env';
import { prisma } from '@/server/lib/prisma';
import { ventanaDeManana } from '@/server/lib/datetime';
import { requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Las citas de MAÑANA, para avisarle hoy a cada paciente.
 *
 * Es la misma ventana que usa la tarea automática de la madrugada, y a
 * propósito: las dos escriben y leen `whatsappReminderSentAt`, así que si algún
 * día la API de WhatsApp queda funcionando, lo que se mandó a mano no se manda
 * dos veces, y lo que la tarea alcanzó a mandar aparece aquí ya marcado.
 *
 * Mañana y no hoy: un recordatorio sirve para que la persona reorganice su día,
 * y eso solo se puede hacer con un día de por medio. Avisar la misma mañana
 * llega tarde para todo menos para cancelar.
 */
export const GET = route(async (req) => {
  requireAuth(req);

  // La ventana la calcula `ventanaDeManana`, compartida con la tarea
  // automática: si cada una la calculara por su lado podrían dejar de
  // coincidir y esta pantalla mostraría un día distinto del que se avisa solo.
  const { desde, hasta, clave } = ventanaDeManana(env.CLINIC_TIMEZONE);

  const items = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: desde, lt: hasta },
      // Una cita cancelada no lleva recordatorio, y una que ya se atendió
      // tampoco: solo las que de verdad van a ocurrir.
      status: { in: [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA] },
    },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      contactName: true,
      contactPhone: true,
      startsAt: true,
      status: true,
      whatsappReminderSentAt: true,
      service: { select: { id: true, name: true } },
      patient: { select: { id: true, fullName: true } },
    },
  });

  return {
    items,
    /** Cuántas faltan por avisar: es el número del menú. */
    pendientes: items.filter((cita) => !cita.whatsappReminderSentAt).length,
    /** Para poder escribir «mañana, viernes 11» sin recalcularlo en el navegador. */
    fecha: clave,
  };
});
