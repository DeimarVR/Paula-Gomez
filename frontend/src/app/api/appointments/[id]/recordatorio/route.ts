import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { body, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const marcaSchema = z.object({ enviado: z.boolean() });

/**
 * Deja constancia de que a este paciente ya se le mandó el recordatorio.
 *
 * Lo escribe la persona al tocar el botón, no el sistema al enviar: el envío
 * ocurre en WhatsApp, fuera de aquí, y desde acá no hay forma de saber si de
 * verdad le dio a enviar. Por eso se puede desmarcar: quien se equivoca lo
 * corrige, en vez de quedarse con una lista que miente.
 *
 * Es el MISMO campo que sella la tarea automática. Así las dos vías cuentan la
 * misma historia y ninguna repite el trabajo de la otra.
 */
export const PATCH = route<{ params: { id: string } }>(async (req, { params }) => {
  requireAuth(req);
  const { enviado } = await body(req, marcaSchema);

  const cita = await prisma.appointment.update({
    where: { id: params.id },
    data: { whatsappReminderSentAt: enviado ? new Date() : null },
    select: { id: true, whatsappReminderSentAt: true },
  });

  return cita;
});
