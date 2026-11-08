import { Role } from '@prisma/client';
import { env } from '@/server/config/env';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { buildWhatsAppLink, normalizePhone } from '@/server/lib/phone';
import { body, requireAuth, requireRole, route } from '@/server/http';
import { archivarPaciente } from '@/server/modules/patients/borrado.service';
import { patientBodySchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export const GET = route<Ctx>(async (req, { params }) => {
  requireAuth(req);

  const patient = await prisma.patient.findUnique({
    where: { id: params.id },
    include: {
      plans: {
        include: {
          service: { select: { id: true, name: true, slug: true } },
          sessions: {
            include: { photos: true, professional: { select: { id: true, fullName: true } } },
            orderBy: { sessionNumber: 'asc' },
          },
        },
        orderBy: { startDate: 'desc' },
      },
      appointments: {
        include: { service: { select: { name: true } } },
        orderBy: { startsAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!patient) throw HttpError.notFound('Paciente no encontrado');

  return {
    ...patient,
    /** Enlace personal del portal de seguimiento, listo para enviar. */
    trackingUrl: `${env.PUBLIC_WEB_URL}/seguimiento/${patient.publicToken}`,
    whatsappLink: buildWhatsAppLink(
      patient.phone,
      `Hola ${patient.fullName.split(' ')[0]}, te compartimos tu seguimiento en ${env.CLINIC_NAME}: ${env.PUBLIC_WEB_URL}/seguimiento/${patient.publicToken}`,
    ),
  };
});

export const PUT = route<Ctx>(async (req, { params }) => {
  requireAuth(req);
  const datos = await body(req, patientBodySchema.partial());

  return prisma.patient.update({
    where: { id: params.id },
    data: {
      ...datos,
      ...(datos.phone ? { phone: normalizePhone(datos.phone) } : {}),
      ...(datos.email !== undefined ? { email: datos.email?.toLowerCase() ?? null } : {}),
      ...(datos.birthDate !== undefined
        ? { birthDate: datos.birthDate ? new Date(datos.birthDate) : null }
        : {}),
    },
  });
});

/**
 * Baja lógica: la historia clínica no se borra.
 *
 * El borrado de verdad —el del duplicado vacío— vive en
 * `/api/patients/[id]/eliminar`, aparte y con su propia comprobación. Aquí no
 * se toca nada del paciente salvo que deje de aparecer en la operación diaria.
 */
export const DELETE = route<Ctx>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);
  const { nombre } = await archivarPaciente(params.id);
  return { message: `${nombre} quedó marcado como inactivo.` };
});
