import { PhotoType, SessionStatus } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import { formatLongEs } from '../../lib/datetime';

/**
 * Portal de seguimiento del paciente.
 *
 * Se accede con un token personal (/seguimiento/<token>), sin usuario ni
 * contraseña: para el paciente es un enlace que llega por WhatsApp.
 *
 * Regla de oro de este módulo: **nunca** se devuelven las notas clínicas
 * internas (`clinicalNotes`) ni las fotos marcadas como no visibles. Solo sale
 * lo que el equipo redactó explícitamente para el paciente.
 */

export interface ProgressPhoto {
  id: string;
  url: string;
  type: PhotoType;
  angle: string;
  caption: string | null;
  takenAt: Date;
}

export async function getPatientProgress(publicToken: string) {
  const patient = await prisma.patient.findUnique({
    where: { publicToken },
    include: {
      plans: {
        where: { status: { in: ['ACTIVO', 'FINALIZADO', 'PAUSADO'] } },
        include: {
          service: { select: { name: true, slug: true, shortDesc: true, icon: true } },
          sessions: {
            include: {
              photos: {
                where: { visibleToPatient: true },
                orderBy: { createdAt: 'asc' },
              },
              professional: { select: { fullName: true } },
            },
            orderBy: { sessionNumber: 'asc' },
          },
        },
        orderBy: { startDate: 'desc' },
      },
      appointments: {
        where: { startsAt: { gte: new Date() }, status: { notIn: ['CANCELADA'] } },
        include: { service: { select: { name: true } } },
        orderBy: { startsAt: 'asc' },
        take: 3,
      },
    },
  });

  if (!patient || !patient.active) {
    throw HttpError.notFound('Ese enlace de seguimiento no es válido');
  }

  const plans = patient.plans.map((plan) => {
    const completed = plan.sessions.filter(
      (session) => session.status === SessionStatus.COMPLETADA,
    );
    const next = plan.sessions.find(
      (session) => session.status === SessionStatus.PROGRAMADA && session.scheduledAt >= new Date(),
    );

    const photos: ProgressPhoto[] = plan.sessions.flatMap((session) =>
      session.photos.map((photo) => ({
        id: photo.id,
        // Las fotos clínicas viven en un bucket privado y se sirven por
        // /api/archivos, que no deja pasar a nadie sin credencial. El paciente
        // no tiene sesión del panel: su llave es este token, así que viaja
        // pegado a la dirección de cada imagen.
        url: photo.url.startsWith('/api/archivos/')
          ? `${photo.url}?t=${publicToken}`
          : photo.url,
        type: photo.type,
        angle: photo.angle,
        caption: photo.caption,
        takenAt: session.performedAt ?? session.scheduledAt,
      })),
    );

    // Para el comparador antes/después se elige la primera y la última foto
    // del mismo ángulo: es la única comparación honesta.
    const anglesWithPairs = [...new Set(photos.map((photo) => photo.angle))]
      .map((angle) => {
        const sameAngle = photos
          .filter((photo) => photo.angle === angle)
          .sort((a, b) => a.takenAt.getTime() - b.takenAt.getTime());
        return sameAngle.length >= 2
          ? { angle, before: sameAngle[0], after: sameAngle[sameAngle.length - 1] }
          : null;
      })
      .filter((pair): pair is NonNullable<typeof pair> => pair !== null);

    return {
      id: plan.id,
      title: plan.title,
      goal: plan.goal,
      status: plan.status,
      service: plan.service,
      startDate: plan.startDate,
      totalSessions: plan.totalSessions,
      completedSessions: completed.length,
      progressPercent: Math.round((completed.length / Math.max(plan.totalSessions, 1)) * 100),
      nextSession: next
        ? {
            id: next.id,
            sessionNumber: next.sessionNumber,
            scheduledAt: next.scheduledAt,
            formattedDate: formatLongEs(next.scheduledAt, env.CLINIC_TIMEZONE),
          }
        : null,
      // Solo campos aptos para el paciente: nada de `clinicalNotes`.
      sessions: plan.sessions.map((session) => ({
        id: session.id,
        sessionNumber: session.sessionNumber,
        status: session.status,
        scheduledAt: session.scheduledAt,
        performedAt: session.performedAt,
        formattedDate: formatLongEs(
          session.performedAt ?? session.scheduledAt,
          env.CLINIC_TIMEZONE,
        ),
        summary: session.patientSummary,
        homeCare: session.homeCare,
        productsUsed: session.productsUsed,
        metrics: session.metrics,
        professional: session.professional?.fullName ?? null,
        photos: session.photos.map((photo) => ({
          id: photo.id,
          url: photo.url,
          type: photo.type,
          angle: photo.angle,
          caption: photo.caption,
        })),
      })),
      comparisons: anglesWithPairs,
    };
  });

  const totalCompleted = plans.reduce((sum, plan) => sum + plan.completedSessions, 0);
  const totalPlanned = plans.reduce((sum, plan) => sum + plan.totalSessions, 0);

  return {
    patient: {
      firstName: patient.fullName.split(' ')[0],
      fullName: patient.fullName,
      memberSince: patient.createdAt,
    },
    summary: {
      activePlans: plans.filter((plan) => plan.status === 'ACTIVO').length,
      completedSessions: totalCompleted,
      plannedSessions: totalPlanned,
      overallProgress: Math.round((totalCompleted / Math.max(totalPlanned, 1)) * 100),
    },
    plans,
    upcomingAppointments: patient.appointments.map((appointment) => ({
      id: appointment.id,
      serviceName: appointment.service.name,
      startsAt: appointment.startsAt,
      status: appointment.status,
      formattedDate: formatLongEs(appointment.startsAt, env.CLINIC_TIMEZONE),
      manageToken: appointment.manageToken,
    })),
    clinic: {
      name: env.CLINIC_NAME,
      whatsapp: env.CLINIC_WHATSAPP,
      address: env.CLINIC_ADDRESS,
    },
  };
}
