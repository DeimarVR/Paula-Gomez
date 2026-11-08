import { z } from 'zod';

/**
 * Fechas SIN HORA: una factura tiene día, no instante; una sesión clínica
 * también.
 *
 * Se guardan a medianoche UTC y se leen en UTC. Si se guardara la hora local
 * del navegador, un documento creado a las 8 de la noche en la zona de la clínica (UTC-5) se
 * archivaría con la fecha del día siguiente. Es el error clásico y silencioso:
 * nadie lo nota hasta que hay que cuadrar un mes.
 */

/** "2026-08-29", validado. */
export const claveFechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
  .refine((valor) => !Number.isNaN(Date.parse(`${valor}T00:00:00Z`)), 'Fecha inválida');

export function fechaDesdeClave(clave: string): Date {
  return new Date(`${clave}T00:00:00.000Z`);
}
