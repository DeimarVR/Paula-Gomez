import { Role } from '@prisma/client';
import { z } from 'zod';
import * as whatsapp from '@/server/services/whatsapp';
import { body, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const testMessageSchema = z.object({
  to: z.string().trim().min(7),
  message: z.string().trim().min(1).max(1000),
});

export const POST = route(async (req) => {
  requireRole(req, Role.ADMIN);
  const { to, message } = await body(req, testMessageSchema);
  return whatsapp.sendText(to, message);
});
