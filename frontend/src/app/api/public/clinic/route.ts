import { clinicInfo } from '@/server/consultas';
import { route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async () => clinicInfo());
