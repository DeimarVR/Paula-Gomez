import { z } from 'zod';

/**
 * Dirección de una imagen guardada en la base.
 *
 * Acepta dos formas: una ruta interna `/api/archivos/...`, que es lo que
 * produce la subida al bucket, o una URL completa. Lo segundo se conserva
 * porque los casos cargados antes de tener bucket guardaron enlaces externos
 * pegados a mano, y romperlos al validar dejaría la galería inservible.
 */
export const urlImagen = z
  .string()
  .trim()
  .min(1)
  .refine(
    (valor) =>
      valor.startsWith('/api/archivos/') || /^https?:\/\/.+/i.test(valor),
    'Sube una imagen o pega una URL válida',
  );
