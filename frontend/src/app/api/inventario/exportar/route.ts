import { ProductKind } from '@prisma/client';
import { z } from 'zod';
import { env } from '@/server/config/env';
import { booleanoDeConsulta, query, requireAuth, route } from '@/server/http';
import { toZonedDateKey } from '@/server/lib/datetime';
import { armarExcel, respuestaDeDescarga } from '@/server/lib/excel';
import { hojaDeInventario } from '@/server/modules/inventario/exportar.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/*
 * Los mismos parámetros que el listado, para que el archivo diga lo mismo que
 * la pantalla desde la que se pidió. `incluirArchivados` se acepta y se ignora:
 * el Excel los trae siempre, marcados en su columna, porque una lista que
 * esconde productos es la que lleva a crearlos repetidos.
 */
const consultaSchema = z.object({
  q: z.string().trim().min(1).optional(),
  kind: z.nativeEnum(ProductKind).optional(),
  soloBajos: booleanoDeConsulta.optional(),
  soloPorVencer: booleanoDeConsulta.optional(),
  incluirArchivados: booleanoDeConsulta.optional(),
  soloArchivados: booleanoDeConsulta.optional(),
  orden: z.enum(['nombre', 'vencimiento']).optional(),
});

/**
 * Descarga el inventario en Excel.
 *
 * Para comparar con una lista de papel o de otro Excel, para el conteo físico
 * del estante, y para pedirle al proveedor. Lo puede bajar cualquiera con
 * sesión: es la misma información que ya ve en pantalla.
 */
export const GET = route(async (req) => {
  requireAuth(req);
  const consulta = query(req, consultaSchema);

  const hojas = await hojaDeInventario(consulta);
  const archivo = await armarExcel(hojas);
  const hoy = toZonedDateKey(new Date(), env.CLINIC_TIMEZONE);

  /*
   * Sin tildes: Chromium descarta el nombre
   * propuesto si lleva un carácter fuera de ASCII y guarda el archivo como
   * «download», sin extensión.
   */
  return respuestaDeDescarga(archivo, `Inventario ${hoy}.xlsx`);
});
