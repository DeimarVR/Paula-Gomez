import { z } from 'zod';
import { instagramFeed } from '@/server/consultas';
import { query, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const feedSchema = z.object({ take: z.coerce.number().int().min(1).max(24).default(8) });

export const GET = route(async (req) => instagramFeed(query(req, feedSchema).take));
