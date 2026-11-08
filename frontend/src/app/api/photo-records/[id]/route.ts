import { Role } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { body, requireAuth, requireRole, route } from '@/server/http';
import { CON_FOTOS, registroSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req, { params }: { params: { id: string } }) => {
  requireAuth(req);

  const registro = await prisma.photoRecord.findUnique({
    where: { id: params.id },
    include: CON_FOTOS,
  });
  if (!registro) throw HttpError.notFound('Registro no encontrado');

  return registro;
});

export const PUT = route(async (req, { params }: { params: { id: string } }) => {
  requireAuth(req);
  const datos = await body(req, registroSchema);

  const existente = await prisma.photoRecord.findUnique({
    where: { id: params.id },
    select: { id: true, photos: { select: { id: true } } },
  });
  if (!existente) throw HttpError.notFound('Registro no encontrado');

  /**
   * Las fotos se cotejan POR ID, no se borran todas para volver a crearlas.
   *
   * Borrar y recrear cambiaría el id de cada foto en cada guardado, y con él
   * cualquier referencia que apunte a ella. Además dejaría huérfanos los
   * archivos del bucket sin que nadie lleve la cuenta.
   */
  const llegan = new Set(datos.fotos.map((foto) => foto.id).filter(Boolean));
  const aBorrar = existente.photos.filter((foto) => !llegan.has(foto.id)).map((foto) => foto.id);

  await prisma.$transaction([
    prisma.photoRecord.update({
      where: { id: existente.id },
      data: {
        patientId: datos.patientId,
        serviceId: datos.serviceId || null,
        title: datos.title,
        notes: datos.notes || null,
        consentSigned: datos.consentSigned,
      },
    }),
    ...(aBorrar.length > 0
      ? [prisma.photoRecordItem.deleteMany({ where: { id: { in: aBorrar } } })]
      : []),
    ...datos.fotos.map((foto, indice) => {
      const comun = {
        url: foto.url,
        type: foto.type,
        angle: foto.angle,
        caption: foto.caption || null,
        ...(foto.takenAt ? { takenAt: new Date(foto.takenAt) } : {}),
        sortOrder: foto.sortOrder || indice,
      };

      return foto.id
        ? prisma.photoRecordItem.update({ where: { id: foto.id }, data: comun })
        : prisma.photoRecordItem.create({ data: { ...comun, recordId: existente.id } });
    }),
  ]);

  return prisma.photoRecord.findUnique({ where: { id: existente.id }, include: CON_FOTOS });
});

export const DELETE = route(async (req, { params }: { params: { id: string } }) => {
  // Borrar material clínico no es cosa de cualquiera con sesión.
  requireRole(req, Role.ADMIN);

  // Las fotos caen con el registro por la cascada declarada en el esquema.
  await prisma.photoRecord.delete({ where: { id: params.id } });

  return { ok: true };
});
