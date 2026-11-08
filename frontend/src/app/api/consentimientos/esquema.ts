import { z } from 'zod';

/**
 * Esquemas de consentimientos.
 *
 * Viven aquí y no en `route.ts` porque Next solo admite exportaciones con
 * nombres conocidos en un archivo de ruta.
 */

export const plantillaSchema = z.object({
  name: z.string().trim().min(3, 'Ponle un nombre al consentimiento'),
  description: z.string().trim().max(500).optional().nullable(),
  /**
   * El texto del consentimiento.
   *
   * El mínimo es alto a propósito: un consentimiento de dos líneas no informa
   * de nada, y guardarlo daría un PDF con una firma debajo de un hueco.
   */
  body: z
    .string()
    .trim()
    .min(120, 'El consentimiento está demasiado corto: escribe el texto completo')
    .max(60000, 'El texto es demasiado largo'),
  serviceIds: z.array(z.string()).default([]),
  active: z.boolean().optional(),
});

export const firmaSchema = z.object({
  templateId: z.string().min(1, 'Elige el consentimiento'),
  patientId: z.string().min(1, 'Elige el paciente'),
  /** PNG en data URL, tal cual sale del pad de firma. */
  signature: z.string().min(50, 'Falta la firma del paciente'),
  professionalName: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});
