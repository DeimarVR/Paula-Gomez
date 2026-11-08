import { revalidatePath } from 'next/cache';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { CLAVES_IMAGENES, imagenesDelSitio } from '@/server/consultas';
import { body, requireAuth, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Imágenes del sitio público, editables desde el panel.
 *
 * Se guardan en `settings` para que cambiar la foto del inicio no obligue a
 * tocar el código ni a esperar un despliegue.
 */

/**
 * Cada imagen es una ruta interna de `/api/archivos/sitio/…`, la que devuelve
 * la subida. No se acepta una dirección cualquiera: sería dejar que alguien
 * con sesión ponga en la portada una imagen alojada en otro servidor, que
 * puede cambiar o desaparecer sin que nos enteremos.
 *
 * La cadena vacía es válida y significa «volver al marcador».
 */
const rutaDeImagen = z
  .string()
  .trim()
  .refine(
    (valor) => valor === '' || valor.startsWith('/api/archivos/sitio/'),
    'La imagen tiene que subirse desde aquí',
  );

const ajustesSchema = z.object({
  hero: rutaDeImagen.optional(),
  nosotros: rutaDeImagen.optional(),
});

export const GET = route(async (req) => {
  requireAuth(req);
  return imagenesDelSitio();
});

export const PUT = route(async (req) => {
  // Cambiar la portada es cosa de quien administra, no de quien atiende.
  requireRole(req, Role.ADMIN);
  const datos = await body(req, ajustesSchema);

  const escrituras = (Object.keys(CLAVES_IMAGENES) as Array<keyof typeof CLAVES_IMAGENES>)
    // Solo se toca lo que vino en la petición: mandar `hero` no debe borrar
    // `nosotros` por el simple hecho de no haberlo mencionado.
    .filter((nombre) => datos[nombre] !== undefined)
    .map((nombre) => {
      const clave = CLAVES_IMAGENES[nombre];
      const valor = datos[nombre] ?? '';

      return valor === ''
        ? prisma.setting.deleteMany({ where: { key: clave } })
        : prisma.setting.upsert({
            where: { key: clave },
            create: { key: clave, value: valor },
            update: { value: valor },
          });
    });

  await prisma.$transaction(escrituras);

  /**
   * La portada se regenera cada 5 minutos. Sin esto, quien acaba de cambiar la
   * foto abriría el sitio, la vería igual y volvería a subirla pensando que
   * algo falló.
   */
  revalidatePath('/');

  return imagenesDelSitio();
});
