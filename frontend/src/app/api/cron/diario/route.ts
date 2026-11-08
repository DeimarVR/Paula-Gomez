import { revalidatePath } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { runDailyJobs } from '@/server/jobs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Enviar los recordatorios puede tardar: un WhatsApp por cita. */
export const maxDuration = 300;

/**
 * Tarea diaria. La invoca Vercel Cron según `vercel.json`.
 *
 * La ruta es pública —Vercel la llama por HTTP desde fuera— así que el
 * candado es el encabezado que Vercel firma con CRON_SECRET. Sin esa variable
 * definida en el proyecto, la ruta responde 401 y no hace nada: es preferible
 * que la tarea no corra a que quede un endpoint abierto que cualquiera pueda
 * disparar para gastar mensajes de WhatsApp.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const resultados = await runDailyJobs();

  // Entre los trabajos está la sincronización del feed. Si trajo publicaciones
  // nuevas, la portada tiene que enterarse en vez de esperar a su propio ciclo.
  revalidatePath('/');

  return NextResponse.json({ ok: true, resultados });
}
