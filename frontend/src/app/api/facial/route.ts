import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as facial from '@/server/modules/facial/facial.service';
import { body, query, requireAuth, route } from '@/server/http';
import { aEntrada, fichaFacialSchema } from './esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const consultaSchema = z.object({
  patientId: z.string().optional(),
  q: z.string().trim().min(1).optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
});

export const GET = route(async (req) => {
  requireAuth(req);
  return { items: await facial.listar(query(req, consultaSchema)) };
});

export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const datos = await body(req, fichaFacialSchema);
  return NextResponse.json(await facial.crear(aEntrada(datos), sesion.sub), { status: 201 });
});
