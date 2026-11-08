import { NextResponse } from 'next/server';
import { getPatientProgress } from '@/server/modules/public/tracking.service';
import { route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route<{ params: { publicToken: string } }>(async (_req, { params }) => {
  const progreso = await getPatientProgress(params.publicToken);

  // Sin caché: es información personal de salud. Ni el navegador ni la CDN de
  // Vercel deben guardar una copia de esto.
  return NextResponse.json(progreso, {
    headers: { 'Cache-Control': 'no-store, private' },
  });
});
