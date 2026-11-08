import { Role } from '@prisma/client';
import * as instagram from '@/server/services/instagram';
import { issueState } from '@/server/oauthState';
import { requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireRole(req, Role.ADMIN);
  return { authUrl: instagram.buildAuthUrl(await issueState('instagram')) };
});
