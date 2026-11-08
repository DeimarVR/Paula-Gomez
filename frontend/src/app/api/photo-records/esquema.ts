import { PhotoType } from '@prisma/client';
import { z } from 'zod';

/**
 * Esquema e includes compartidos por las rutas del registro fotográfico.
 *
 * Viven aquí y no en `route.ts` porque Next solo admite exportaciones con
 * nombres conocidos (GET, POST, runtime…) en un archivo de ruta: cualquier
 * otra rompe la comprobación de tipos del build.
 */

/**
 * La ruta de cada foto tiene que venir de nuestra propia subida.
 *
 * Aceptar una dirección cualquiera sería permitir que la historia clínica de
 * un paciente apunte a un servidor ajeno, que puede caerse, cambiar la imagen
 * o registrar quién la mira.
 */
const rutaDeFoto = z
  .string()
  .trim()
  .startsWith('/api/archivos/galeria/', 'La foto tiene que subirse desde el panel');

const fotoSchema = z.object({
  /** Presente al editar una foto que ya existe; ausente si es nueva. */
  id: z.string().optional(),
  url: rutaDeFoto,
  type: z.nativeEnum(PhotoType).default(PhotoType.PROGRESO),
  angle: z.string().trim().min(1).max(40).default('frontal'),
  caption: z.string().trim().max(200).optional().nullable(),
  takenAt: z.string().datetime().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const registroSchema = z.object({
  patientId: z.string().min(1, 'Elige el paciente'),
  serviceId: z.string().optional().nullable(),
  title: z.string().trim().min(3, 'Ponle un título al registro'),
  notes: z.string().trim().max(1000).optional().nullable(),
  consentSigned: z.boolean().default(false),
  fotos: z.array(fotoSchema).default([]),
});

/** Lo que se manda al navegador. Siempre con las fotos en orden. */
export const CON_FOTOS = {
  photos: { orderBy: [{ sortOrder: 'asc' as const }, { takenAt: 'asc' as const }] },
  patient: { select: { id: true, fullName: true, phone: true } },
  service: { select: { id: true, name: true } },
};

