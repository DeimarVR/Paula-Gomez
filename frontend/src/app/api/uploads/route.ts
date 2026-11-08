import { z } from 'zod';
import {
  TAMANO_MAXIMO,
  TIPOS_PERMITIDOS,
  construirClave,
  esCarpetaValida,
  firmarSubida,
  rutaPublica,
  tipoAdmitido,
  type Carpeta,
} from '@/server/storage';
import { HttpError } from '@/server/lib/httpError';
import { body, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const subidaSchema = z.object({
  carpeta: z.string().refine(esCarpetaValida, 'Carpeta no válida'),
  contentType: z.enum(TIPOS_PERMITIDOS),
  /** Tamaño declarado por el navegador, para rechazar antes de subir. */
  size: z.coerce.number().int().positive(),
});

/**
 * Entrega una URL firmada para subir un archivo directo al bucket.
 *
 * El archivo no pasa por aquí: esta ruta solo autoriza. Así se esquiva el
 * límite de 4,5 MB por petición de las funciones, que una foto de celular
 * supera sin problema.
 *
 * El tamaño que llega es el que declara el navegador y no se puede confiar en
 * él, así que sirve para dar un error claro y temprano, no como candado. El
 * candado de verdad es la política del bucket.
 */
export const POST = route(async (req) => {
  requireAuth(req);
  const datos = await body(req, subidaSchema);

  // El tipo se valida CONTRA LA CARPETA, no contra la lista global: subir un
  // PDF a la galería de fotos rompería la vista previa sin decir por qué.
  if (!tipoAdmitido(datos.carpeta as Carpeta, datos.contentType)) {
    throw HttpError.unprocessable(
      `Esa carpeta no admite archivos de tipo ${datos.contentType}.`,
    );
  }

  if (datos.size > TAMANO_MAXIMO) {
    throw HttpError.unprocessable(
      `El archivo pesa más de ${Math.round(TAMANO_MAXIMO / 1024 / 1024)} MB. Comprímelo antes de subirlo.`,
    );
  }

  const clave = construirClave(datos.carpeta, datos.contentType);

  return {
    urlDeSubida: await firmarSubida(clave, datos.contentType),
    clave,
    /** Lo que hay que guardar en la base. Nunca la URL del bucket. */
    ruta: rutaPublica(clave),
  };
});
