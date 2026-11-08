import { PhotoType, PlanStatus, SessionStatus } from '@prisma/client';
import { z } from 'zod';
import { urlImagen } from '@/server/validaciones';

/** Hora de apertura usada al programar un plan sin fecha explícita. */
export const DEFAULT_PLAN_START_TIME = '09:00';

export const planSchema = z.object({
  patientId: z.string().min(1),
  serviceId: z.string().min(1),
  title: z.string().trim().min(3),
  goal: z.string().trim().max(500).optional().nullable(),
  totalSessions: z.coerce.number().int().min(1).max(60).default(1),
  intervalDays: z.coerce.number().int().min(1).max(180).default(21),
  startDate: z.string().datetime().optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
  /** Crea de una vez las sesiones programadas del protocolo. */
  autoSchedule: z.boolean().default(true),
});

export const planUpdateSchema = z.object({
  title: z.string().trim().min(3).optional(),
  goal: z.string().trim().max(500).optional().nullable(),
  totalSessions: z.coerce.number().int().min(1).max(60).optional(),
  intervalDays: z.coerce.number().int().min(1).max(180).optional(),
  status: z.nativeEnum(PlanStatus).optional(),
  notes: z.string().trim().max(5000).optional().nullable(),
});

export const agendaQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.nativeEnum(SessionStatus).optional(),
});

export const sessionCreateSchema = z.object({
  planId: z.string().min(1),
  sessionNumber: z.coerce.number().int().min(1).optional(),
  scheduledAt: z.string().datetime(),
});

export const sessionUpdateSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  performedAt: z.string().datetime().optional().nullable(),
  status: z.nativeEnum(SessionStatus).optional(),
  clinicalNotes: z.string().trim().max(8000).optional().nullable(),
  patientSummary: z.string().trim().max(2000).optional().nullable(),
  homeCare: z.string().trim().max(2000).optional().nullable(),
  productsUsed: z.array(z.string().trim().min(1)).max(30).optional(),
  /** Densidad, grosor, escala Ludwig/Hamilton… estructura libre. */
  metrics: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().nullable(),
  professionalId: z.string().optional().nullable(),
  /** Avisa al paciente por WhatsApp de que su seguimiento se actualizó. */
  notifyPatient: z.boolean().default(false),
});

export const photoSchema = z.object({
  url: urlImagen,
  type: z.nativeEnum(PhotoType).default(PhotoType.PROGRESO),
  /** Mantener el mismo ángulo entre sesiones es lo que hace comparable la foto. */
  angle: z.string().trim().min(1).default('frontal'),
  caption: z.string().trim().max(300).optional().nullable(),
  visibleToPatient: z.boolean().default(true),
});
