import { NextResponse } from 'next/server';
import { ProductKind, Role } from '@prisma/client';
import { z } from 'zod';
import * as inventario from '@/server/modules/inventario/inventario.service';
import { body, booleanoDeConsulta, query, requireAuth, requireRole, route } from '@/server/http';
import { productoSchema } from './esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const consultaSchema = z.object({
  q: z.string().trim().min(1).optional(),
  kind: z.nativeEnum(ProductKind).optional(),
  soloBajos: booleanoDeConsulta.optional(),
  soloPorVencer: booleanoDeConsulta.optional(),
  incluirArchivados: booleanoDeConsulta.optional(),
  soloArchivados: booleanoDeConsulta.optional(),
  orden: z.enum(['nombre', 'vencimiento']).optional(),
});

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, consultaSchema);

  // Los avisos viajan con el listado: el panel los necesita a la vez y
  // pedirlos aparte solo añade un parpadeo.
  const [items, porVencer, sinPrecio] = await Promise.all([
    inventario.listarInventario(q),
    inventario.lotesPorVencer(),
    inventario.productosSinPrecio(),
  ]);

  return { items, porVencer, sinPrecio };
});

/**
 * Dar de alta un producto. Recepción no.
 *
 * Un producto nuevo trae precio de venta y mínimo, que son decisiones del
 * centro, no del mostrador. Recepción sigue registrando entradas y salidas de
 * lo que ya existe, que es su trabajo del día.
 */
export const POST = route(async (req) => {
  const sesion = requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  const datos = await body(req, productoSchema);
  return NextResponse.json(await inventario.crearProducto(datos, sesion.sub), { status: 201 });
});
