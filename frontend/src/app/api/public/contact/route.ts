import { NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/server/config/env';
import { prisma } from '@/server/lib/prisma';
import { buildWhatsAppLink, normalizePhone } from '@/server/lib/phone';
import { LIMITES, body, limitar, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const contactSchema = z.object({
  name: z.string().trim().min(3, 'Escribe tu nombre'),
  phone: z.string().trim().min(7, 'El teléfono es obligatorio'),
  email: z.string().email('Correo inválido').optional().or(z.literal('')),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(10, 'Cuéntanos un poco más').max(2000),
  website: z.string().max(0).optional(),
});

export const POST = route(async (req) => {
  limitar(req, 'contacto', LIMITES.formulario);
  const datos = await body(req, contactSchema);

  if (datos.website) {
    return NextResponse.json({ message: 'Mensaje recibido' }, { status: 201 });
  }

  await prisma.contactMessage.create({
    data: {
      name: datos.name,
      phone: normalizePhone(datos.phone),
      email: datos.email || null,
      subject: datos.subject || null,
      message: datos.message,
    },
  });

  return NextResponse.json(
    {
      message: 'Recibimos tu mensaje. Te contactamos muy pronto.',
      whatsappLink: buildWhatsAppLink(
        env.CLINIC_WHATSAPP,
        `Hola, soy ${datos.name}. ${datos.message}`,
      ),
    },
    { status: 201 },
  );
});
