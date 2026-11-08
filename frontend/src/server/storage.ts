import { randomBytes } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { HttpError } from './lib/httpError';

/**
 * Almacenamiento de archivos en un bucket S3.
 *
 * El bucket es privado y así se queda: nada se sirve desde su dominio. Las
 * imágenes salen por `/api/archivos`, que comprueba quién pide qué antes de
 * entregar los bytes. Una foto clínica en una URL pública solo estaría
 * protegida porque nadie adivina la dirección, y eso no es protección.
 *
 * La subida sí va directa del navegador al bucket, con una URL firmada de
 * cinco minutos. Es lo que esquiva el límite de 4,5 MB por petición de las
 * funciones de Vercel, que una foto de celular se salta sin esfuerzo.
 */

const CARPETAS = ['galeria', 'sesiones', 'sitio', 'consentimientos', 'expedientes'] as const;
export type Carpeta = (typeof CARPETAS)[number];

export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

/**
 * Qué formatos admite cada carpeta.
 *
 * No es una lista única a propósito: una foto clínica tiene que ser una imagen,
 * y un consentimiento tiene que ser un PDF. Aceptar cualquier cosa en todas
 * partes deja subir un PDF donde se espera una foto y romper la vista previa
 * sin que nadie entienda por qué.
 */
export const TIPOS_POR_CARPETA: Record<Carpeta, readonly string[]> = {
  galeria: TIPOS_IMAGEN,
  sesiones: TIPOS_IMAGEN,
  sitio: TIPOS_IMAGEN,
  consentimientos: ['application/pdf'],
  // Las hojas en papel: casi siempre una foto del celular, a veces un PDF
  // escaneado en el computador del consultorio.
  expedientes: [...TIPOS_IMAGEN, 'application/pdf'],
};

/** Todos los tipos que el sistema acepta, en cualquier carpeta. */
export const TIPOS_PERMITIDOS = [...TIPOS_IMAGEN, 'application/pdf'] as const;

export function tipoAdmitido(carpeta: Carpeta, contentType: string): boolean {
  return TIPOS_POR_CARPETA[carpeta].includes(contentType);
}
export const TAMANO_MAXIMO = 15 * 1024 * 1024;

function config() {
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;

  if (!S3_ENDPOINT || !S3_BUCKET || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY) {
    throw HttpError.serviceUnavailable(
      'El almacenamiento de archivos no está configurado. Faltan las variables S3_*.',
    );
  }

  return {
    bucket: S3_BUCKET,
    cliente: new S3Client({
      endpoint: S3_ENDPOINT,
      region: S3_REGION ?? 'auto',
      // Los proveedores compatibles con S3 casi siempre esperan la ruta con el
      // bucket dentro de la URL, no como subdominio.
      forcePathStyle: true,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
    }),
  };
}

/**
 * Nombre del objeto dentro del bucket.
 *
 * Lleva un aleatorio y descarta el nombre original salvo la extensión: el
 * nombre de archivo que llega del navegador es dato de entrada, y ha servido
 * para escaparse de la carpeta con un `../` más veces de las que debería.
 */
export function construirClave(carpeta: Carpeta, contentType: string): string {
  const extension =
    {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/avif': 'avif',
      'application/pdf': 'pdf',
    }[contentType] ?? 'bin';

  const fecha = new Date().toISOString().slice(0, 7); // AAAA-MM
  return `${carpeta}/${fecha}/${randomBytes(16).toString('hex')}.${extension}`;
}

export function esCarpetaValida(valor: string): valor is Carpeta {
  return (CARPETAS as readonly string[]).includes(valor);
}

/** URL firmada para SUBIR. Vive cinco minutos. */
export async function firmarSubida(clave: string, contentType: string): Promise<string> {
  const { cliente, bucket } = config();
  return getSignedUrl(
    cliente,
    new PutObjectCommand({ Bucket: bucket, Key: clave, ContentType: contentType }),
    { expiresIn: 300 },
  );
}

/** Trae el objeto para servirlo desde nuestra ruta. */
export async function leerObjeto(clave: string) {
  const { cliente, bucket } = config();
  const salida = await cliente.send(new GetObjectCommand({ Bucket: bucket, Key: clave }));

  if (!salida.Body) throw HttpError.notFound('Archivo no encontrado');

  return {
    cuerpo: salida.Body.transformToWebStream(),
    contentType: salida.ContentType ?? 'application/octet-stream',
    tamano: salida.ContentLength,
    etag: salida.ETag,
  };
}

/**
 * Sube un archivo DESDE EL SERVIDOR.
 *
 * La subida normal la hace el navegador con una URL firmada, para esquivar el
 * límite de tamaño de las funciones. Pero el consentimiento firmado lo arma el
 * servidor —toma la plantilla, le pega la hoja de firma y produce un PDF
 * nuevo—, así que ese archivo nunca pasa por el navegador y necesita este
 * camino.
 */
export async function guardarObjeto(
  clave: string,
  cuerpo: Uint8Array,
  contentType: string,
): Promise<string> {
  const { cliente, bucket } = config();
  await cliente.send(
    new PutObjectCommand({ Bucket: bucket, Key: clave, Body: cuerpo, ContentType: contentType }),
  );
  return rutaPublica(clave);
}

export async function borrarObjeto(clave: string): Promise<void> {
  const { cliente, bucket } = config();
  await cliente.send(new DeleteObjectCommand({ Bucket: bucket, Key: clave }));
}

/** Ruta interna que se guarda en la base, nunca la URL del bucket. */
export function rutaPublica(clave: string): string {
  return `/api/archivos/${clave}`;
}

/** Camino inverso: de la ruta guardada a la clave del objeto. */
export function claveDesdeRuta(ruta: string): string | null {
  const prefijo = '/api/archivos/';
  return ruta.startsWith(prefijo) ? ruta.slice(prefijo.length) : null;
}
