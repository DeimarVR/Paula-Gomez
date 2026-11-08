import { NextResponse } from 'next/server';
import { env } from '@/server/config/env';
import { HttpError } from '@/server/lib/httpError';
import * as instagram from '@/server/services/instagram';
import { consumeState } from '@/server/oauthState';
import { route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Vuelve al panel con el resultado en la barra de direcciones. */
function alPanel(params: Record<string, string>): NextResponse {
  const url = new URL('/admin/integraciones', env.PUBLIC_WEB_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url.toString());
}

export const GET = route(async (req) => {
  const p = req.nextUrl.searchParams;
  const error = p.get('error');

  if (error) {
    return alPanel({ instagram: 'error', message: p.get('error_description') ?? error });
  }

  await consumeState(p.get('state') ?? undefined, 'instagram');

  const code = p.get('code');
  if (!code) throw HttpError.badRequest('Falta el código de autorización');

  const expiresAt = await instagram.exchangeCodeForLongLivedToken(code);
  await instagram.syncPosts(12);

  return alPanel({ instagram: 'ok', expira: expiresAt?.toISOString() ?? '' });
});
