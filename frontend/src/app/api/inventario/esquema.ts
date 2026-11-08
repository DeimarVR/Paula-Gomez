import { ProductKind, StockMoveReason, StockMoveType } from '@prisma/client';
import { z } from 'zod';

/**
 * Esquemas compartidos por las rutas del inventario.
 *
 * Viven aquí y no en `route.ts` porque Next solo admite exportaciones con
 * nombres conocidos (GET, POST, runtime…) en un archivo de ruta: cualquier
 * otra rompe la comprobación de tipos del build.
 */

export const productoSchema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre del producto'),
  kind: z.nativeEnum(ProductKind).default(ProductKind.INSUMO),
  sku: z.string().trim().max(60).optional().nullable(),
  unit: z.string().trim().min(1, 'Indica cómo se cuenta: unidad, ampolla, caja…').default('unidad'),
  presentation: z.string().trim().max(120).optional().nullable(),
  category: z.string().trim().max(60).optional().nullable(),
  /** En pesos enteros: no se manejan centavos. */
  salePrice: z.coerce.number().int().min(0).max(100_000_000).optional().nullable(),
  supplier: z.string().trim().max(120).optional().nullable(),
  minStock: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().max(500).optional().nullable(),
  active: z.boolean().optional(),
  /** Solo se usa al crear: al editar, la existencia se cambia con movimientos. */
  cantidadInicial: z.coerce.number().int().min(0).optional().nullable(),
});

/**
 * La fecha llega partida y en hora de la clínica, no como instante ya resuelto:
 * si la armara el navegador usaría SU zona, y un movimiento anotado desde un
 * equipo mal configurado caería en el día equivocado.
 */
export const movimientoSchema = z.object({
  productId: z.string().min(1, 'Elige el producto'),
  type: z.nativeEnum(StockMoveType),
  reason: z.nativeEnum(StockMoveReason).default(StockMoveReason.OTRO),
  quantity: z.coerce.number().int().positive('La cantidad tiene que ser mayor que cero'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige la fecha'),
  hora: z.string().regex(/^\d{2}:\d{2}$/).default('12:00'),
  patientId: z.string().optional().nullable(),
  lotNumber: z.string().trim().max(60).optional().nullable(),
  /** Solo la fecha: un vencimiento no tiene hora. */
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal('')),
  unitCost: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});
