import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/config';
import { getServices } from '@/lib/api';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const services = await getServices();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE.url, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE.url}/resultados`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE.url}/reservar`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE.url}/contacto`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    {
      url: `${SITE.url}/politica-de-datos`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  return [
    ...staticPages,
    ...services.map((service) => ({
      url: `${SITE.url}/servicios/${service.slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
