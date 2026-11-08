import { StockMoveType } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { requireAuth, route } from '@/server/http';
import type { Hecho } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Historial completo de un paciente, en una sola línea de tiempo.
 *
 * Antes, para saber qué se le había hecho a alguien había que abrir cuatro
 * pantallas: las fichas en Control de pacientes, las imágenes en Fotos, los
 * productos en Inventario, y las citas por su lado. Cada
 * módulo guarda su parte bien; lo que faltaba era el sitio donde se juntan.
 *
 * Se arma en el servidor y no en el navegador a propósito: son seis consultas
 * que desde el panel serían seis viajes y un ordenamiento en el cliente que
 * hay que rehacer cada vez que se agrega una fuente.
 */

export const GET = route(async (req, { params }: { params: { id: string } }) => {
  requireAuth(req);
  const patientId = params.id;

  const [capilares, faciales, consentimientos, fotos, productos, citas] =
    await Promise.all([
    prisma.clinicalRecord.findMany({
      where: { patientId },
      select: { id: true, procedureDate: true, careType: true, _count: { select: { entries: true } } },
    }),
    prisma.facialRecord.findMany({
      where: { patientId },
      select: { id: true, openedAt: true, skinCondition: true, _count: { select: { entries: true } } },
    }),
    prisma.signedConsent.findMany({
      where: { patientId },
      select: {
        id: true,
        templateName: true,
        templateVersion: true,
        signedAt: true,
        fileUrl: true,
      },
    }),
    prisma.photoRecord.findMany({
      where: { patientId },
      select: { id: true, title: true, createdAt: true, _count: { select: { photos: true } } },
    }),
    prisma.stockMove.findMany({
      where: { patientId, type: StockMoveType.SALIDA },
      select: {
        id: true,
        occurredAt: true,
        quantity: true,
        product: { select: { name: true, unit: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { patientId },
      select: {
        id: true,
        startsAt: true,
        status: true,
        service: { select: { name: true } },
      },
    }),
  ]);

  const hechos: Hecho[] = [
    ...capilares.map((f) => ({
      id: f.id,
      tipo: 'ficha-capilar' as const,
      fecha: f.procedureDate.toISOString(),
      titulo: f.careType === 'TRASPLANTE' ? 'Ficha de trasplante' : 'Ficha capilar',
      detalle: `${f._count.entries} ${f._count.entries === 1 ? 'sesión' : 'sesiones'}`,
      enlace: `/admin/control-pacientes/${f.id}`,
    })),
    ...faciales.map((f) => ({
      id: f.id,
      tipo: 'ficha-facial' as const,
      fecha: f.openedAt.toISOString(),
      titulo: 'Ficha facial',
      detalle: [
        f.skinCondition,
        `${f._count.entries} ${f._count.entries === 1 ? 'sesión' : 'sesiones'}`,
      ]
        .filter(Boolean)
        .join(' · '),
      enlace: `/admin/control-pacientes/facial/${f.id}`,
    })),
    /**
     * El consentimiento enlaza al PDF firmado, no a la pantalla del módulo:
     * lo que hace falta ver desde el historial de un paciente es el documento
     * que él firmó, no el listado de todos.
     */
    ...consentimientos.map((c) => ({
      id: c.id,
      tipo: 'consentimiento' as const,
      fecha: c.signedAt.toISOString(),
      titulo: c.templateName,
      detalle: `Firmado · versión ${c.templateVersion}`,
      enlace: c.fileUrl,
    })),
    ...fotos.map((r) => ({
      id: r.id,
      tipo: 'fotos' as const,
      fecha: r.createdAt.toISOString(),
      titulo: r.title,
      detalle: `${r._count.photos} ${r._count.photos === 1 ? 'foto' : 'fotos'}`,
      enlace: '/admin/fotos',
    })),
    ...productos.map((m) => ({
      id: m.id,
      tipo: 'producto' as const,
      fecha: m.occurredAt.toISOString(),
      titulo: m.product.name,
      detalle: `${m.quantity} ${m.product.unit}`,
    })),
    ...citas.map((c) => ({
      id: c.id,
      tipo: 'cita' as const,
      fecha: c.startsAt.toISOString(),
      titulo: c.service?.name ?? 'Cita',
      detalle: c.status.charAt(0) + c.status.slice(1).toLowerCase().replace('_', ' '),
      enlace: '/admin/citas',
    })),
  ];

  // Lo más reciente primero: en una historia clínica se consulta hacia atrás.
  hechos.sort((a, b) => b.fecha.localeCompare(a.fecha));

  return { items: hechos };
});
