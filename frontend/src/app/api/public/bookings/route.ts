import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as appointments from '@/server/modules/appointments/appointments.service';
import { LIMITES, body, limitar, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bookingSchema = z.object({
  /** Ya no decide nada: hay un solo tipo de cita. Se acepta para no romper formularios viejos. */
  serviceId: z.string().optional(),
  contactName: z.string().trim().min(3, 'Escribe tu nombre completo'),
  contactPhone: z.string().trim().min(7, 'El teléfono es obligatorio'),
  contactEmail: z.string().email('Correo inválido').optional().or(z.literal('')),
  message: z.string().trim().max(600).optional(),
  startsAt: z.string().datetime('Selecciona un horario válido'),
  /** Campo trampa para bots: si viene lleno, se descarta la solicitud. */
  website: z.string().max(0).optional(),
  acceptsPolicy: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar la política de tratamiento de datos' }),
  }),
});

export const POST = route(async (req) => {
  limitar(req, 'reserva', LIMITES.formulario);
  const datos = await body(req, bookingSchema);

  if (datos.website) {
    // Bot detectado: se responde 201 para no darle pistas, sin guardar nada.
    return NextResponse.json({ message: 'Solicitud recibida' }, { status: 201 });
  }

  const result = await appointments.createBooking({
    contactName: datos.contactName,
    contactPhone: datos.contactPhone,
    contactEmail: datos.contactEmail || undefined,
    message: datos.message,
    startsAt: new Date(datos.startsAt),
  });

  return NextResponse.json(
    {
      message: 'Tu cita quedó registrada',
      appointment: {
        id: result.appointment.id,
        startsAt: result.appointment.startsAt,
        endsAt: result.appointment.endsAt,
        status: result.appointment.status,
      },
      manageToken: result.appointment.manageToken,
      manageUrl: result.manageUrl,
      whatsappLink: result.whatsappLink,
      notifications: {
        whatsappSent: result.whatsappSent,
        calendarSynced: result.calendarSynced,
      },
    },
    { status: 201 },
  );
});
