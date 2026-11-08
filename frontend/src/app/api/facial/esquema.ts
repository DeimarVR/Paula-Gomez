import { SkinType } from '@prisma/client';
import { z } from 'zod';
import { env } from '@/server/config/env';
import { parseZonedDateTime } from '@/server/lib/datetime';

/**
 * Esquema de la ficha facial.
 *
 * Vive aquí y no en `route.ts` porque Next solo admite exportaciones con
 * nombres conocidos en un archivo de ruta.
 *
 * Las fechas llegan como «AAAA-MM-DD» y se convierten con la zona de la
 * clínica, no con la del navegador: una ficha abierta desde un equipo con la
 * zona mal puesta no puede quedar fechada el día anterior.
 */

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha esperado: AAAA-MM-DD');

const lineaSchema = z.object({
  id: z.string().optional(),
  sessionDate: fecha,
  sessionLabel: z.string().trim().max(40).optional().nullable(),
  serviceId: z.string().optional().nullable(),
  zones: z.array(z.string()).default([]),
  productId: z.string().optional().nullable(),
  productName: z.string().trim().max(120).optional().nullable(),
  lotNumber: z.string().trim().max(60).optional().nullable(),
  /**
   * Decimal a propósito: 1,5 ml de bioestimulador es una cantidad real y
   * redondearla sería falsear la historia clínica. Es la excepción a la regla
   * de enteros que rige el dinero.
   */
  quantity: z.coerce.number().min(0).optional().nullable(),
  quantityUnit: z.string().trim().max(12).optional().nullable(),
  technique: z.string().trim().max(300).optional().nullable(),
  findings: z.string().trim().max(1000).optional().nullable(),
  homeCare: z.string().trim().max(1000).optional().nullable(),
  nextControl: fecha.optional().nullable().or(z.literal('')),
  nextControlTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal('')),
  nextControlServiceId: z.string().optional().nullable(),
  professionalSignature: z.string().optional().nullable(),
  patientSignature: z.string().optional().nullable(),
});

export const fichaFacialSchema = z.object({
  patientId: z.string().min(1, 'Elige el paciente'),
  openedAt: fecha,
  patientName: z.string().trim().min(2, 'Falta el nombre del paciente'),
  patientDocument: z.string().trim().max(30).optional().nullable(),
  patientAge: z.coerce.number().int().min(0).max(120).optional().nullable(),
  patientPhone: z.string().trim().max(30).optional().nullable(),
  skinType: z.nativeEnum(SkinType).optional().nullable().or(z.literal('')),
  skinCondition: z.string().trim().max(120).optional().nullable(),
  concerns: z.array(z.string().trim().max(80)).default([]),
  allergies: z.string().trim().max(500).optional().nullable(),
  contraindications: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  entries: z.array(lineaSchema).default([]),
});

/**
 * Pasa lo que llegó por HTTP a lo que espera el servicio.
 *
 * Las fechas se convierten con la zona de la CLÍNICA y a mediodía: a mediodía
 * porque una fecha sin hora convertida a medianoche se corre al día anterior en
 * cuanto alguien la formatea en otra zona, y eso en una historia clínica es un
 * error que nadie detecta hasta que importa.
 */
export function aEntrada(datos: z.infer<typeof fichaFacialSchema>) {
  const zona = env.CLINIC_TIMEZONE;

  return {
    ...datos,
    skinType: datos.skinType || null,
    openedAt: parseZonedDateTime(datos.openedAt, '12:00', zona),
    entries: datos.entries.map((linea) => ({
      ...linea,
      sessionDate: parseZonedDateTime(linea.sessionDate, '12:00', zona),
      nextControl: linea.nextControl ? parseZonedDateTime(linea.nextControl, '12:00', zona) : null,
    })),
  };
}
