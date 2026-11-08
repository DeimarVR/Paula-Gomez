import { getServiceBySlug } from '@/server/consultas';
import { HttpError } from '@/server/lib/httpError';
import { route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route<{ params: { slug: string } }>(async (_req, { params }) => {
  const service = await getServiceBySlug(params.slug);
  if (!service) throw HttpError.notFound('Tratamiento no encontrado');
  return service;
});
