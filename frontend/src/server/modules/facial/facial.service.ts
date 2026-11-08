import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';

/**
 * Ficha facial y estética.
 *
 * Documento aparte de la ficha capilar. Lo que comparten es el paciente y el
 * criterio: los datos personales se congelan al abrirla, y las sesiones se
 * cotejan por id al guardar en vez de borrarse y recrearse.
 */

export interface LineaEntrada {
  id?: string;
  sessionDate: Date;
  sessionLabel?: string | null;
  serviceId?: string | null;
  zones: string[];
  productId?: string | null;
  productName?: string | null;
  lotNumber?: string | null;
  quantity?: number | null;
  quantityUnit?: string | null;
  technique?: string | null;
  findings?: string | null;
  homeCare?: string | null;
  nextControl?: Date | null;
  nextControlTime?: string | null;
  nextControlServiceId?: string | null;
  professionalSignature?: string | null;
  patientSignature?: string | null;
}

export interface FichaEntrada {
  patientId: string;
  openedAt: Date;
  patientName: string;
  patientDocument?: string | null;
  patientAge?: number | null;
  patientPhone?: string | null;
  skinType?: string | null;
  skinCondition?: string | null;
  concerns: string[];
  allergies?: string | null;
  contraindications?: string | null;
  notes?: string | null;
  entries: LineaEntrada[];
}

const CON_TODO = {
  patient: { select: { id: true, fullName: true, phone: true, documentId: true } },
  createdBy: { select: { fullName: true } },
  entries: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      service: { select: { id: true, name: true } },
      nextControlService: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, unit: true } },
    },
  },
};

/** Los campos de una línea, listos para crear o actualizar. */
function datosDeLinea(linea: LineaEntrada, indice: number) {
  return {
    sessionDate: linea.sessionDate,
    sessionLabel: linea.sessionLabel?.trim() || null,
    serviceId: linea.serviceId || null,
    zones: linea.zones,
    productId: linea.productId || null,
    productName: linea.productName?.trim() || null,
    lotNumber: linea.lotNumber?.trim() || null,
    quantity: linea.quantity ?? null,
    quantityUnit: linea.quantityUnit?.trim() || null,
    technique: linea.technique?.trim() || null,
    findings: linea.findings?.trim() || null,
    homeCare: linea.homeCare?.trim() || null,
    nextControl: linea.nextControl ?? null,
    nextControlTime: linea.nextControlTime?.trim() || null,
    nextControlServiceId: linea.nextControlServiceId || null,
    professionalSignature: linea.professionalSignature ?? null,
    patientSignature: linea.patientSignature ?? null,
    sortOrder: indice,
  };
}

export async function crear(datos: FichaEntrada, createdById?: string) {
  const paciente = await prisma.patient.findUnique({
    where: { id: datos.patientId },
    select: { id: true },
  });
  if (!paciente) throw HttpError.notFound('Paciente no encontrado');

  return prisma.facialRecord.create({
    data: {
      patientId: datos.patientId,
      openedAt: datos.openedAt,
      patientName: datos.patientName.trim(),
      patientDocument: datos.patientDocument?.trim() || null,
      patientAge: datos.patientAge ?? null,
      patientPhone: datos.patientPhone?.trim() || null,
      skinType: (datos.skinType as never) || null,
      skinCondition: datos.skinCondition?.trim() || null,
      concerns: datos.concerns,
      allergies: datos.allergies?.trim() || null,
      contraindications: datos.contraindications?.trim() || null,
      notes: datos.notes?.trim() || null,
      createdById: createdById ?? null,
      entries: { create: datos.entries.map(datosDeLinea) },
    },
    include: CON_TODO,
  });
}

export async function actualizar(id: string, datos: FichaEntrada) {
  const existente = await prisma.facialRecord.findUnique({
    where: { id },
    select: { id: true, entries: { select: { id: true } } },
  });
  if (!existente) throw HttpError.notFound('Ficha no encontrada');

  /**
   * Las líneas se cotejan POR ID, no se borran todas para volver a crearlas.
   *
   * Recrearlas cambiaría el id de cada sesión en cada guardado, y con él
   * cualquier referencia que apunte a ella —la cita del próximo control, el
   * día que se enlace—.
   */
  const llegan = new Set(datos.entries.map((linea) => linea.id).filter(Boolean));
  const aBorrar = existente.entries.filter((linea) => !llegan.has(linea.id)).map((l) => l.id);

  await prisma.$transaction([
    prisma.facialRecord.update({
      where: { id: existente.id },
      data: {
        openedAt: datos.openedAt,
        patientName: datos.patientName.trim(),
        patientDocument: datos.patientDocument?.trim() || null,
        patientAge: datos.patientAge ?? null,
        patientPhone: datos.patientPhone?.trim() || null,
        skinType: (datos.skinType as never) || null,
        skinCondition: datos.skinCondition?.trim() || null,
        concerns: datos.concerns,
        allergies: datos.allergies?.trim() || null,
        contraindications: datos.contraindications?.trim() || null,
        notes: datos.notes?.trim() || null,
      },
    }),
    ...(aBorrar.length > 0
      ? [prisma.facialEntry.deleteMany({ where: { id: { in: aBorrar } } })]
      : []),
    ...datos.entries.map((linea, indice) =>
      linea.id
        ? prisma.facialEntry.update({ where: { id: linea.id }, data: datosDeLinea(linea, indice) })
        : prisma.facialEntry.create({
            data: { ...datosDeLinea(linea, indice), recordId: existente.id },
          }),
    ),
  ]);

  return prisma.facialRecord.findUnique({ where: { id: existente.id }, include: CON_TODO });
}

export function obtener(id: string) {
  return prisma.facialRecord.findUnique({ where: { id }, include: CON_TODO });
}

export function listar(params: { patientId?: string; q?: string; take?: number } = {}) {
  return prisma.facialRecord.findMany({
    where: {
      ...(params.patientId ? { patientId: params.patientId } : {}),
      ...(params.q
        ? {
            OR: [
              { patientName: { contains: params.q, mode: 'insensitive' as const } },
              { patientDocument: { contains: params.q } },
            ],
          }
        : {}),
    },
    include: {
      patient: { select: { id: true, fullName: true } },
      _count: { select: { entries: true } },
    },
    orderBy: { openedAt: 'desc' },
    take: params.take ?? 50,
  });
}

export async function borrar(id: string) {
  const existe = await prisma.facialRecord.findUnique({ where: { id }, select: { id: true } });
  if (!existe) throw HttpError.notFound('Ficha no encontrada');

  // Las sesiones caen con la ficha por la cascada declarada en el esquema.
  await prisma.facialRecord.delete({ where: { id } });
  return { ok: true };
}
