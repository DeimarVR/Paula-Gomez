import { Gender } from '@prisma/client';
import { z } from 'zod';

export const patientBodySchema = z.object({
  fullName: z.string().trim().min(3, 'El nombre completo es obligatorio'),
  documentId: z.string().trim().min(4).optional().nullable(),
  email: z.string().email('Correo inválido').optional().nullable(),
  phone: z.string().trim().min(7, 'El teléfono es obligatorio'),
  birthDate: z.string().datetime().optional().nullable(),
  gender: z.nativeEnum(Gender).default(Gender.NO_DECLARA),
  city: z.string().trim().optional().nullable(),
  medicalNotes: z.string().trim().max(5000).optional().nullable(),
  photoConsent: z.boolean().default(false),
});
