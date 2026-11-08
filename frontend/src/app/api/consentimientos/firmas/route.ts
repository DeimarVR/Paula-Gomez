import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as consentimientos from '@/server/modules/consentimientos/consentimientos.service';
import { body, query, requireAuth, route } from '@/server/http';
import { firmaSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const consultaSchema = z.object({
  patientId: z.string().optional(),
  take: z.coerce.number().int().min(1).max(200).default(100),
});

export const GET = route(async (req) => {
  requireAuth(req);
  return { items: await consentimientos.listarFirmados(query(req, consultaSchema)) };
});

/**
 * Firmar.
 *
 * La hora se toma AQUÍ, en el servidor, y no llega desde el navegador: es el
 * momento en que se firmó, y un dato con valor legal no puede depender de la
 * hora que tenga puesta el equipo desde el que se firma.
 */
export const POST = route(async (req) => {
  const sesion = requireAuth(req);
  const datos = await body(req, firmaSchema);

  const firmado = await consentimientos.firmar(
    {
      ...datos,
      signedAt: new Date(),
      professionalName: datos.professionalName || sesion.fullName,
    },
    sesion.sub,
  );

  return NextResponse.json(firmado, { status: 201 });
});
