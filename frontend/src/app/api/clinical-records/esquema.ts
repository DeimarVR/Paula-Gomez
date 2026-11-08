import { CareType } from '@prisma/client';
import { z } from 'zod';
import { claveFechaSchema } from '@/server/lib/fechaDia';

/** Igual que en la firma de facturación: solo PNG y con tope de tamaño. */
const firma = z
  .string()
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, 'La firma debe ser una imagen PNG')
  .max(600_000, 'La firma es demasiado pesada')
  .nullish();

const texto = (max: number) => z.string().trim().max(max).nullish();

export const lineaSchema = z.object({
  sessionDate: claveFechaSchema,
  controlLabel: texto(20),
  alopeciaType: texto(120),
  treatment: texto(240),
  treatedZone: texto(120),
  oralMedication: texto(160),
  topicalMedication: texto(160),
  shampoo: texto(160),
  findings: texto(400),
  nextControl: claveFechaSchema.nullish(),
  /** "HH:mm" en 24 horas. Sin hora no se puede agendar la cita. */
  nextControlTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida')
    .nullish(),
  nextControlServiceId: z.string().trim().min(1).nullish(),
  professionalSignature: firma,
  patientSignature: firma,
  /** Id de la fila si ya existía; permite casarla al actualizar. */
  id: z.string().trim().min(1).nullish(),
});

export const fichaSchema = z.object({
  patientId: z.string().trim().min(1, 'Selecciona el paciente'),
  procedureDate: claveFechaSchema,

  patientName: z.string().trim().min(2, 'Falta el nombre del paciente').max(160),
  patientDocument: texto(40),
  /**
   * Se valida hasta 130 por lo mismo que en cualquier campo de edad: un dedo
   * de más en el teclado no puede dejar guardada una ficha de 220 años.
   */
  patientAge: z.number().int().min(0).max(130).nullish(),
  patientPhone: texto(40),

  careType: z.nativeEnum(CareType).default(CareType.TERAPIAS_CAPILARES),
  totalSessions: z.number().int().min(0).max(999).nullish(),

  transplantBeard: z.boolean().default(false),
  transplantEyebrows: z.boolean().default(false),
  transplantScalp: z.boolean().default(false),
  transplantZones: z.array(z.number().int().min(1).max(4)).max(4).default([]),

  follicles: z.number().int().min(0).max(100_000).nullish(),
  folliclesLost: z.number().int().min(0).max(100_000).nullish(),
  warranty: texto(160),

  markedZones: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  notes: texto(1000),

  entries: z.array(lineaSchema).max(60).default([]),
});

export const listadoSchema = z.object({
  q: z.string().trim().min(1).optional(),
  patientId: z.string().trim().min(1).optional(),
  /**
   * «FACIAL» no está en el enum de la base a propósito: la ficha facial es otra
   * tabla, no otro tipo de atención. Acá se acepta como un valor más porque
   * para quien filtra en la pantalla son tres cosas del mismo estante.
   */
  careType: z.union([z.nativeEnum(CareType), z.literal('FACIAL')]).optional(),
  take: z.coerce.number().int().min(1).max(200).default(40),
  skip: z.coerce.number().int().min(0).default(0),
});
