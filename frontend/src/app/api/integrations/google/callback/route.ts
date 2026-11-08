import { NextResponse } from 'next/server';
import { env } from '@/server/config/env';
import { HttpError } from '@/server/lib/httpError';
import * as googleCalendar from '@/server/services/googleCalendar';
import { consumeState } from '@/server/oauthState';
import { route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function alPanel(params: Record<string, string>): NextResponse {
  const url = new URL('/admin/integraciones', env.PUBLIC_WEB_URL);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return NextResponse.redirect(url.toString());
}

export const GET = route(async (req) => {
  const p = req.nextUrl.searchParams;
  const error = p.get('error');

  if (error) return alPanel({ google: 'error', message: error });

  await consumeState(p.get('state') ?? undefined, 'google');

  const code = p.get('code');
  if (!code) throw HttpError.badRequest('Falta el código de autorización');

  await googleCalendar.handleOAuthCallback(code);
  return alPanel({ google: 'ok' });
});
