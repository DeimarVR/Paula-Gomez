import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { body, query, requireAuth, route } from '@/server/http';
import { CON_FOTOS, registroSchema } from './esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Registro fotográfico de los pacientes. TODO es interno.
 *
 * No hay ruta pública equivalente, a diferencia de la vieja galería, y no debe
 * haberla: los casos que salen en el sitio están escritos a mano en
 * `config.ts`, elegidos uno por uno. Si algún día hace falta publicar desde
 * aquí, que sea una decisión explícita y no el efecto de haber dejado la
 * puerta entornada.
 */

const listQuerySchema = z.object({
  patientId: z.string().optional(),
  q: z.string().trim().min(1).optional(),
  take: z.coerce.number().int().min(1).max(100).default(50),
});

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, listQuerySchema);

  return {
    items: await prisma.photoRecord.findMany({
      where: {
        ...(q.patientId ? { patientId: q.patientId } : {}),
        ...(q.q
          ? {
              OR: [
                { title: { contains: q.q, mode: 'insensitive' as const } },
                { patient: { fullName: { contains: q.q, mode: 'insensitive' as const } } },
                { patient: { documentId: { contains: q.q } } },
              ],
            }
          : {}),
      },
      include: CON_FOTOS,
      orderBy: { createdAt: 'desc' },
      take: q.take,
    }),
  };
});

export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const datos = await body(req, registroSchema);

  const registro = await prisma.photoRecord.create({
    data: {
      patientId: datos.patientId,
      serviceId: datos.serviceId || null,
      title: datos.title,
      notes: datos.notes || null,
      consentSigned: datos.consentSigned,
      createdById: sesion.sub,
      photos: {
        create: datos.fotos.map((foto, indice) => ({
          url: foto.url,
          type: foto.type,
          angle: foto.angle,
          caption: foto.caption || null,
          takenAt: foto.takenAt ? new Date(foto.takenAt) : undefined,
          sortOrder: foto.sortOrder || indice,
        })),
      },
    },
    include: CON_FOTOS,
  });

  return NextResponse.json(registro, { status: 201 });
});
