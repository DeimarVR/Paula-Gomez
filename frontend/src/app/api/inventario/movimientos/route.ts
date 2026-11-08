import { NextResponse } from 'next/server';
import { Role, StockMoveType } from '@prisma/client';
import { z } from 'zod';
import { env } from '@/server/config/env';
import * as inventario from '@/server/modules/inventario/inventario.service';
import { HttpError } from '@/server/lib/httpError';
import { addDays, parseZonedDateTime } from '@/server/lib/datetime';
import { body, query, requireAuth, requireRole, route } from '@/server/http';
import { movimientoSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const consultaSchema = z.object({
  productId: z.string().optional(),
  patientId: z.string().optional(),
  type: z.nativeEnum(StockMoveType).optional(),
  desde: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  take: z.coerce.number().int().min(1).max(300).default(100),
});

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, consultaSchema);
  const zona = env.CLINIC_TIMEZONE;

  return {
    items: await inventario.listarMovimientos({
      productId: q.productId,
      patientId: q.patientId,
      type: q.type,
      desde: q.desde ? parseZonedDateTime(q.desde, '00:00', zona) : undefined,
      // El «hasta» que llega es un día inclusive; el servicio corta con `<`,
      // así que se avanza al día siguiente para no dejar fuera esa jornada.
      hasta: q.hasta ? addDays(parseZonedDateTime(q.hasta, '00:00', zona), 1) : undefined,
      take: q.take,
    }),
  };
});

export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const datos = await body(req, movimientoSchema);
  const zona = env.CLINIC_TIMEZONE;

  let occurredAt: Date;
  try {
    occurredAt = parseZonedDateTime(datos.fecha, datos.hora, zona);
  } catch {
    throw HttpError.badRequest('La fecha del movimiento no es válida');
  }

  const movimiento = await inventario.registrarMovimiento(
    {
      productId: datos.productId,
      type: datos.type,
      reason: datos.reason,
      quantity: datos.quantity,
      occurredAt,
      patientId: datos.patientId,
      lotNumber: datos.lotNumber,
      // El vencimiento se guarda a mediodía de la clínica: así ninguna
      // conversión de zona lo corre al día anterior al mostrarlo.
      expiresAt: datos.expiresAt ? parseZonedDateTime(datos.expiresAt, '12:00', zona) : null,
      unitCost: datos.unitCost,
      notes: datos.notes,
    },
    sesion.sub,
  );

  return NextResponse.json(movimiento, { status: 201 });
});

const correccionSchema = z.object({
  id: z.string().min(1),
  motivo: z.string().trim().max(200).optional(),
});

/**
 * Corregir un movimiento mal anotado. Solo el administrador.
 *
 * Aquí había un DELETE que borraba la fila. Ya no existe, y no es un descuido:
 * el historial del inventario no se borra. Un movimiento equivocado se
 * compensa con otro y los dos se quedan, que es lo único que permite responder
 * después «¿por qué no cuadra el conteo?».
 *
 * Es PATCH y no DELETE porque no se está quitando nada: se está agregando la
 * corrección.
 */
export const PATCH = route(async (req) => {
  const sesion = requireRole(req, Role.ADMIN);
  const datos = await body(req, correccionSchema);
  return NextResponse.json(
    await inventario.corregirMovimiento(datos.id, datos.motivo, sesion.sub),
    { status: 201 },
  );
});
