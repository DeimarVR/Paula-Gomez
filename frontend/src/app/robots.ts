import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // El panel y las páginas con token contienen datos personales.
      disallow: ['/admin', '/admin/', '/seguimiento/', '/cita/'],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
