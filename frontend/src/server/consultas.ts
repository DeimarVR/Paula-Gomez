import { env } from './config/env';
import { prisma } from './lib/prisma';
import { buildWhatsAppLink } from './lib/phone';
import { getCachedPosts } from './services/instagram';

/**
 * Lecturas públicas de la base.
 *
 * Un solo sitio para las consultas que necesitan tanto las páginas —que las
 * llaman directamente, sin dar la vuelta por HTTP— como las rutas de /api,
 * que existen para el navegador. Antes esto vivía en el backend y el sitio lo
 * consultaba por red; ahora comparten proceso y la vuelta sobraba.
 */

/**
 * Imágenes del sitio que se cambian desde el panel.
 *
 * Viven en `settings` y no en el código porque son lo que más se cambia y lo
 * que menos justifica un despliegue: cambiar la foto del inicio no debería
 * exigir tocar un archivo ni esperar a que alguien publique.
 *
 * La lista de claves es cerrada a propósito. `settings` es una tabla de
 * clave/valor, y sin una lista blanca cualquier ruta que escriba ahí podría
 * inventarse claves nuevas y nadie sabría después qué significa cada una.
 */
export const CLAVES_IMAGENES = {
  hero: 'sitio.imagen.hero',
  nosotros: 'sitio.imagen.nosotros',
} as const;

export type ClaveImagen = keyof typeof CLAVES_IMAGENES;

export async function imagenesDelSitio(): Promise<Record<ClaveImagen, string | null>> {
  const filas = await prisma.setting.findMany({
    where: { key: { in: Object.values(CLAVES_IMAGENES) } },
  });

  const porClave = new Map(filas.map((fila) => [fila.key, fila.value]));

  return {
    hero: porClave.get(CLAVES_IMAGENES.hero) || null,
    nosotros: porClave.get(CLAVES_IMAGENES.nosotros) || null,
  };
}

export function clinicInfo() {
  return {
    name: env.CLINIC_NAME,
    address: env.CLINIC_ADDRESS,
    timezone: env.CLINIC_TIMEZONE,
    whatsapp: env.CLINIC_WHATSAPP,
    whatsappLink: buildWhatsAppLink(
      env.CLINIC_WHATSAPP,
      `¡Hola ${env.CLINIC_NAME}! Quiero información sobre sus tratamientos.`,
    ),
    instagram: `https://www.instagram.com/${env.INSTAGRAM_USERNAME}/`,
    instagramUser: env.INSTAGRAM_USERNAME,
  };
}

export function listServices() {
  return prisma.service.findMany({
    // Doble candado, igual que la galería: activo Y publicado.
    where: { active: true, published: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export function getServiceBySlug(slug: string) {
  return prisma.service.findFirst({
    where: { slug, active: true, published: true },
  });
}

export function listTestimonials() {
  return prisma.testimonial.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: 12,
  });
}

export async function instagramFeed(take = 8) {
  const posts = await getCachedPosts(take);
  return {
    username: env.INSTAGRAM_USERNAME,
    profileUrl: `https://www.instagram.com/${env.INSTAGRAM_USERNAME}/`,
    items: posts.map((post) => ({
      id: post.igId,
      caption: post.caption,
      mediaType: post.mediaType,
      mediaUrl: post.mediaUrl,
      thumbnailUrl: post.thumbnailUrl,
      permalink: post.permalink,
      postedAt: post.postedAt,
    })),
  };
}
