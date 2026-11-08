import * as googleCalendar from '@/server/services/googleCalendar';
import * as instagram from '@/server/services/instagram';
import * as whatsapp from '@/server/services/whatsapp';
import { requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAuth(req);
  const [ig, google, wa] = await Promise.all([
    instagram.getStatus(),
    googleCalendar.getStatus(),
    whatsapp.getStatus(),
  ]);
  return { instagram: ig, googleCalendar: google, whatsapp: wa };
});
