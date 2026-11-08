import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as consentimientos from '@/server/modules/consentimientos/consentimientos.service';
import { body, booleanoDeConsulta, query, requireAuth, route } from '@/server/http';
import { plantillaSchema } from './esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const consultaSchema = z.object({
  incluirInactivas: booleanoDeConsulta.optional(),
});

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, consultaSchema);
  return { items: await consentimientos.listarPlantillas(q.incluirInactivas ?? false) };
});

export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const datos = await body(req, plantillaSchema);
  return NextResponse.json(await consentimientos.crearPlantilla(datos, sesion.sub), {
    status: 201,
  });
});
