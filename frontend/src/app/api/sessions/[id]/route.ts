import { Prisma, SessionStatus } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import * as whatsapp from '@/server/services/whatsapp';
import { body, requireAuth, route } from '@/server/http';
import { sessionUpdateSchema } from '../esquemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

export const PUT = route<Ctx>(async (req, { params }) => {
  const sesion = requireAuth(req);
  const { notifyPatient, ...data } = await body(req, sessionUpdateSchema);

  const existing = await prisma.treatmentSession.findUnique({
    where: { id: params.id },
    include: { plan: { include: { patient: true } } },
  });
  if (!existing) throw HttpError.notFound('Sesión no encontrada');

  // Al marcarla como completada se sella la fecha automáticamente y se deja
  // registrado qué profesional la atendió.
  const completing =
    data.status === SessionStatus.COMPLETADA && existing.status !== SessionStatus.COMPLETADA;

  const update: Prisma.TreatmentSessionUncheckedUpdateInput = {};

  if (data.scheduledAt) update.scheduledAt = new Date(data.scheduledAt);
  if (data.status !== undefined) update.status = data.status;
  if (data.clinicalNotes !== undefined) update.clinicalNotes = data.clinicalNotes;
  if (data.patientSummary !== undefined) update.patientSummary = data.patientSummary;
  if (data.homeCare !== undefined) update.homeCare = data.homeCare;
  if (data.productsUsed !== undefined) update.productsUsed = data.productsUsed;
  if (data.metrics !== undefined) update.metrics = data.metrics ?? Prisma.DbNull;
  if (data.professionalId !== undefined) update.professionalId = data.professionalId;

  if (data.performedAt !== undefined) {
    update.performedAt = data.performedAt ? new Date(data.performedAt) : null;
  }

  if (completing) {
    update.performedAt ??= new Date();
    update.professionalId ??= sesion.sub;
  }

  const session = await prisma.treatmentSession.update({
    where: { id: existing.id },
    data: update,
    include: { photos: true },
  });

  let whatsappResult: whatsapp.SendResult | null = null;
  if (notifyPatient) {
    whatsappResult = await whatsapp.sendText(
      existing.plan.patient.phone,
      whatsapp.buildSessionUpdateText(
        existing.plan.patient.fullName,
        session.sessionNumber,
        existing.plan.totalSessions,
        existing.plan.patient.publicToken,
      ),
    );
  }

  return { session, whatsapp: whatsappResult };
});

export const DELETE = route<Ctx>(async (req, { params }) => {
  requireAuth(req);
  await prisma.treatmentSession.delete({ where: { id: params.id } });
  return { message: 'Sesión eliminada' };
});
