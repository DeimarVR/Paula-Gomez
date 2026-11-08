import { z } from 'zod';

/**
 * Dos días, en minutos. Es lo que dura el procedimiento más largo del centro:
 * un trasplante capilar de día completo que a veces se va a un segundo día.
 */
const DURACION_MAXIMA = 2880;

/**
 * Los mensajes están escritos en español y se explican solos.
 *
 * No es cosmética. Cuando algo no cumple, el servidor manda estos textos y el
 * panel los enseña tal cual, así que tienen que decir qué campo es y qué se
 * espera de él sin que haga falta mirar el código. Los de serie de zod salen en
 * inglés y dicen «Number must be greater than or equal to 15», que en el
 * mostrador no le sirve a nadie.
 */
export const serviceSchema = z.object({
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, 'El slug solo admite minúsculas, números y guiones'),
  name: z.string().trim().min(3, 'El nombre del tratamiento es muy corto'),
  shortDesc: z
    .string()
    .trim()
    .min(10, 'La descripción corta necesita al menos 10 caracteres')
    .max(200, 'La descripción corta no puede pasar de 200 caracteres'),
  description: z.string().trim().min(20, 'La descripción necesita al menos 20 caracteres'),
  /**
   * La duración la decide el centro, no el sistema.
   *
   * Los dos extremos estaban puestos a ojo y los dos estorbaban. El mínimo eran
   * 15 minutos y una valoración dura 10. El tope eran 8 horas y un trasplante
   * capilar es de día completo —hasta dos días—, así que ni siquiera se podía
   * guardar. Ahora va de 5 minutos a 2 días, que cubre desde lo más corto que
   * hacen hasta lo más largo, y el tope sigue sirviendo para atrapar el dedazo
   * de quien escriba los minutos donde va el precio.
   *
   * Ojo con lo que significa una duración larga en la agenda: la cita ocupa ese
   * rato de reloj de corrido. 1440 minutos son 24 horas, así que un trasplante
   * que empieza el lunes a las 3:30 pm tiene tomado hasta el martes a las
   * 3:30 pm. Si lo que se quiere es «ese día y ya», la duración es la jornada
   * (300 minutos de lunes a viernes, 720 el sábado), no 1440.
   */
  durationMin: z.coerce
    .number({ invalid_type_error: 'La duración tiene que ser un número de minutos' })
    .int('La duración va en minutos enteros')
    .min(5, 'La duración mínima es de 5 minutos')
    .max(DURACION_MAXIMA, 'La duración no puede pasar de 2 días (2880 minutos)')
    .default(60),
  priceCop: z.coerce
    .number({ invalid_type_error: 'El precio tiene que ser un número' })
    .int('El precio va en pesos enteros, sin decimales')
    .min(0, 'El precio no puede ser negativo')
    .optional()
    .nullable(),
  sessionsAdvice: z.coerce
    .number({ invalid_type_error: 'Las sesiones tienen que ser un número' })
    .int('Las sesiones van en números enteros')
    .min(1, 'Si se indican sesiones, tiene que ser al menos 1')
    .max(60, 'Son demasiadas sesiones: el máximo es 60')
    .optional()
    .nullable(),
  category: z.string().trim().default('General'),
  imageUrl: z.string().url('La imagen tiene que ser una dirección web completa').optional().nullable(),
  icon: z.string().trim().default('sparkles'),
  benefits: z
    .array(z.string().trim().min(3, 'Cada beneficio necesita al menos 3 caracteres'))
    .max(12, 'Son demasiados beneficios: el máximo es 12')
    .default([]),
  featured: z.boolean().default(false),
  active: z.boolean().default(true),
  /** Sale en la web. Un tratamiento a medio escribir se deja sin publicar. */
  published: z.boolean().default(true),
  sortOrder: z.coerce.number().int('El orden va en números enteros').default(0),
});

/**
 * Alta rápida desde donde se elige un tratamiento.
 *
 * Pide solo lo imprescindible para operar —nombre, duración y precio— y rellena
 * el resto con marcadores. Nace SIN PUBLICAR: sirve al instante para agendar y
 * facturar, pero no aparece en la web hasta que alguien lo termine de escribir
 * en Tratamientos.
 */
export const servicioRapidoSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Escribe el nombre del tratamiento')
    .max(80, 'El nombre no puede pasar de 80 caracteres'),
  // El mismo mínimo que arriba: si aquí fuera otro, el mismo tratamiento se
  // podría crear desde un sitio y no desde el otro.
  durationMin: z.coerce
    .number({ invalid_type_error: 'La duración tiene que ser un número de minutos' })
    .int('La duración va en minutos enteros')
    .min(5, 'La duración mínima es de 5 minutos')
    .max(DURACION_MAXIMA, 'La duración no puede pasar de 2 días (2880 minutos)')
    .default(60),
  priceCop: z.coerce
    .number({ invalid_type_error: 'El precio tiene que ser un número' })
    .int('El precio va en pesos enteros, sin decimales')
    .min(0, 'El precio no puede ser negativo')
    .nullish(),
  sessionsAdvice: z.coerce
    .number({ invalid_type_error: 'Las sesiones tienen que ser un número' })
    .int('Las sesiones van en números enteros')
    .min(1, 'Si se indican sesiones, tiene que ser al menos 1')
    .max(60, 'Son demasiadas sesiones: el máximo es 60')
    .nullish(),
  category: z.string().trim().min(1, 'Escribe una categoría').default('General'),
});
