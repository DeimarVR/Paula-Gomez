import { z } from 'zod';

/**
 * Todas las variables de entorno del servidor pasan por aquí.
 *
 * Next carga los .env por su cuenta, así que no hace falta dotenv.
 *
 * Las integraciones (Google, WhatsApp, Instagram) son OPCIONALES a propósito:
 * el servidor arranca sin ellas y cada módulo se degrada con elegancia
 * (por ejemplo, sin Google Calendar la cita igual se guarda en la base de
 * datos, solo que no se sincroniza con la agenda).
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatorio'),

  // Seguridad -------------------------------------------------------------
  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('8h'),


  /** URL pública del frontend, usada para armar enlaces enviados por WhatsApp. */
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),

  // Clínica ---------------------------------------------------------------
  /** Como firma el centro sus mensajes: con la C mayúscula, como siempre. */
  CLINIC_NAME: z.string().default('[NOMBRE_CLÍNICA]'),
  CLINIC_TIMEZONE: z.string().default('America/Bogota'),
  /**
   * La sede COMPLETA, como la dicta el centro por teléfono.
   *
   * Va entera y no «[CIUDAD]» porque este texto se lee tal cual en el
   * mensaje de confirmación: al paciente hay que decirle a qué puerta llegar.
   */
  CLINIC_ADDRESS: z.string().default('[DIRECCIÓN]'),
  /** Formato internacional sin "+", ej: 573001112233 */
  CLINIC_WHATSAPP: z.string().default('573000000000'),

  // Asistente de IA -------------------------------------------------------
  /**
   * La clave de Groq. Solo aquí, nunca en el navegador.
   *
   * Es opcional: sin ella el asistente sigue funcionando con el intérprete por
   * reglas, igual que las demás integraciones.
   */
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  /**
   * El interruptor del modo IA. Apagado por defecto A PROPÓSITO: enciende
   * gasto y manda a un tercero lo que la gente escriba en el chat, así que se
   * prende a mano cuando el centro lo decida, no por instalar el código.
   */
  AI_AGENT_ENABLED: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  /** Tope de llamadas al modelo por día, para toda la clínica. 0 = sin tope. */
  AI_TOPE_DIARIO: z.coerce.number().int().min(0).default(300),
  /** Tope de llamadas al modelo por mes, para toda la clínica. 0 = sin tope. */
  AI_TOPE_MENSUAL: z.coerce.number().int().min(0).default(5000),

  // Google Calendar -------------------------------------------------------
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  /** Se obtiene una sola vez con el flujo OAuth de /api/integrations/google. */
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().default('primary'),

  // WhatsApp Cloud API ----------------------------------------------------
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v21.0'),
  /** Plantilla aprobada en Meta para confirmar la cita. */
  WHATSAPP_TEMPLATE_CONFIRMATION: z.string().optional(),
  WHATSAPP_TEMPLATE_REMINDER: z.string().optional(),
  /** Plantilla para ofrecer un hueco liberado: {{1}} el hueco, {{2}} su cita, {{3}} el enlace. */
  WHATSAPP_TEMPLATE_HUECO: z.string().optional(),
  /** Plantilla de la disculpa por día cerrado: {{1}} la cita cancelada, {{2}} el enlace. */
  WHATSAPP_TEMPLATE_DIA_CERRADO: z.string().optional(),

  // Instagram -------------------------------------------------------------
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  INSTAGRAM_REDIRECT_URI: z.string().optional(),
  /**
   * Token de larga duración inicial. Solo se usa la primera vez: a partir de
   * ahí el valor vigente vive en la tabla `integration_tokens` y se renueva
   * solo mediante el cron de refresco.
   */
  INSTAGRAM_ACCESS_TOKEN: z.string().optional(),
  INSTAGRAM_USERNAME: z.string().default(''),
  INSTAGRAM_API_VERSION: z.string().default('v21.0'),

  // Tareas programadas ----------------------------------------------------
  /** Renueva el token de Instagram. Por defecto: todos los días a las 3:15 am. */

  /** Sincroniza las publicaciones. Por defecto: cada hora. */

  /** Recordatorios de cita por WhatsApp. Por defecto: cada día a las 9:00 am. */

});

type Env = z.infer<typeof schema>;

let comprobadas: Env | null = null;

/**
 * Lee y valida el entorno la PRIMERA vez que alguien pide una variable.
 *
 * Antes esto se ejecutaba al importar el módulo, y eso rompía el build: al
 * compilar, Next importa cada ruta para inspeccionarla, sin ejecutar ningún
 * manejador. Con la validación en la importación, compilar exigía tener las
 * credenciales de producción a mano —y un despliegue de vista previa sin
 * variables ni siquiera llegaba a construirse.
 *
 * Aplazándola, compilar no necesita secretos y atender una petición sí. Que
 * es como debe ser: son dos momentos distintos.
 */
function cargar(): Env {
  if (comprobadas) return comprobadas;

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  · ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    // Nada de process.exit: aquí corremos dentro de una función de Vercel y
    // matar el proceso deja al cliente sin respuesta. Un throw sube al
    // manejador de errores, que responde 500 con el detalle en desarrollo.
    throw new Error(`Variables de entorno inválidas:\n${detail}`);
  }

  comprobadas = parsed.data;
  return comprobadas;
}

/**
 * Se usa igual que antes —`env.DATABASE_URL`—, pero detrás hay un proxy que
 * dispara la comprobación en el primer acceso. Así ningún archivo tuvo que
 * cambiar su forma de leer el entorno.
 */
export const env = new Proxy({} as Env, {
  get: (_objetivo, propiedad: string) => cargar()[propiedad as keyof Env],
  has: (_objetivo, propiedad: string) => propiedad in cargar(),
  ownKeys: () => Reflect.ownKeys(cargar()),
  getOwnPropertyDescriptor: (_objetivo, propiedad: string) => ({
    value: cargar()[propiedad as keyof Env],
    enumerable: true,
    configurable: true,
  }),
});

/**
 * Estas tres se leen de `process.env` directo y no del esquema, a propósito:
 * si pasaran por `env` se evaluarían al importar el módulo y volveríamos a
 * exigir el entorno completo en tiempo de compilación, que es justo lo que
 * este archivo acaba de dejar de hacer.
 */
export const isProd = process.env.NODE_ENV === 'production';

/** ¿Están completas las credenciales de Google Calendar? */
export const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI,
);

/** ¿Está configurada la WhatsApp Cloud API para envíos automáticos? */
export const whatsappConfigured = Boolean(
  process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN,
);

/** ¿Hay credenciales de Instagram para sincronizar el feed? */
export const instagramConfigured = Boolean(
  process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET,
);
