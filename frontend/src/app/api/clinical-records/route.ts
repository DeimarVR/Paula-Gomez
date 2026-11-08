import { NextResponse } from 'next/server';
import { body, query, requireAuth, route } from '@/server/http';
import {
  crear,
  listar,
  sincronizarProximosControles,
} from '@/server/modules/clinical/clinical.service';
import { fichaSchema, listadoSchema } from './esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, listadoSchema);
  return listar(q);
});

export const POST = route(async (req) => {
  const usuario = requireAuth(req);
  const datos = await body(req, fichaSchema);
  const ficha = await crear(datos, usuario.sub);

  // La agenda se toca DESPUÉS de guardar: si un horario choca, la ficha ya
  // está a salvo y la persona solo ve un aviso.
  const avisos = await sincronizarProximosControles(ficha.id);

  return NextResponse.json({ ...ficha, avisos }, { status: 201 });
});
