import { env } from '@/server/config/env';
import { createLogger } from '@/server/lib/logger';

const log = createLogger('asistente');

/**
 * El cliente de Groq. Lo único de este módulo que habla con fuera.
 *
 * La clave vive en las variables de entorno del servidor y nunca sale de
 * aquí: el navegador habla con `/api/asistente`, y esta ruta con Groq. Si
 * alguna vez se mueve a otro proveedor, se cambia este archivo y nada más.
 */

const URL_GROQ = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Cuánto se espera según el tipo de llamada.
 *
 * Elegir una acción es una respuesta corta y tiene que sentirse instantánea;
 * redactar un texto da más margen; una tanda de ideas es lo más largo. El
 * navegador espera un poco MÁS que estos números —lo pone el cliente— para que
 * quien corte sea siempre el servidor y la persona reciba un mensaje escrito y
 * no un error de red pelado.
 */
export const ESPERA = {
  accion: 20_000,
  texto: 35_000,
  ideas: 110_000,
} as const;

export interface MensajeGroq {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface RespuestaGroq {
  texto: string;
  llamadas: Array<{ nombre: string; argumentos: Record<string, unknown> }>;
}

export class ErrorDeIA extends Error {
  constructor(
    message: string,
    readonly causa: 'apagada' | 'timeout' | 'proveedor' | 'formato',
  ) {
    super(message);
    this.name = 'ErrorDeIA';
  }
}

/** ¿Está el modo IA encendido y con clave puesta? */
export function iaDisponible(): boolean {
  /*
   * El `Boolean` no sobra: con `&&` a secas, si la variable no está puesta
   * esto devuelve `undefined` en vez de `false`, y al serializarlo a JSON la
   * clave desaparece de la respuesta. La pantalla recibía un hueco donde
   * esperaba un sí o un no.
   */
  return Boolean(env.AI_AGENT_ENABLED) && Boolean(env.GROQ_API_KEY);
}

interface Opciones {
  mensajes: MensajeGroq[];
  herramientas?: unknown[];
  espera?: number;
  /** Entre 0 y 1. Para elegir una acción va bajo: no se quiere creatividad. */
  temperatura?: number;
  maxTokens?: number;
}

/**
 * Una llamada a Groq, con su límite de tiempo.
 *
 * Lo que sale de aquí ya está desmenuzado en texto y llamadas a herramientas.
 * Cualquier fallo —de red, de formato, de tiempo— sale como `ErrorDeIA` con su
 * causa, para que quien llame decida si cae al respaldo o avisa.
 */
export async function preguntarle({
  mensajes,
  herramientas,
  espera = ESPERA.accion,
  temperatura = 0.2,
  maxTokens = 1024,
}: Opciones): Promise<RespuestaGroq> {
  if (!iaDisponible()) throw new ErrorDeIA('El modo IA está apagado', 'apagada');

  const corte = AbortSignal.timeout(espera);

  let bruto: Response;
  try {
    bruto = await fetch(URL_GROQ, {
      method: 'POST',
      signal: corte,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages: mensajes,
        temperature: temperatura,
        max_tokens: maxTokens,
        ...(herramientas?.length ? { tools: herramientas, tool_choice: 'auto' } : {}),
      }),
    });
  } catch (fallo) {
    const porTiempo = fallo instanceof Error && fallo.name === 'TimeoutError';
    log.error('groq no respondió', { causa: porTiempo ? 'timeout' : String(fallo) });
    throw new ErrorDeIA('Groq no respondió', porTiempo ? 'timeout' : 'proveedor');
  }

  if (!bruto.ok) {
    /*
     * El cuerpo del error se queda en el log y NUNCA sube al usuario: trae el
     * modelo, a veces parte del prompt, y siempre un tono que no es el del
     * centro. Arriba se traduce a una frase corta en español.
     */
    const detalle = await bruto.text().catch(() => '');
    log.error('groq devolvió error', { estado: bruto.status, detalle: detalle.slice(0, 400) });
    throw new ErrorDeIA(`Groq respondió ${bruto.status}`, 'proveedor');
  }

  let datos: {
    choices?: Array<{ message?: MensajeGroq }>;
  };
  try {
    datos = (await bruto.json()) as typeof datos;
  } catch {
    throw new ErrorDeIA('Groq devolvió algo que no es JSON', 'formato');
  }

  const mensaje = datos.choices?.[0]?.message;
  if (!mensaje) throw new ErrorDeIA('Groq devolvió una respuesta vacía', 'formato');

  const llamadas: RespuestaGroq['llamadas'] = [];
  for (const llamada of mensaje.tool_calls ?? []) {
    /*
     * Los argumentos vienen como texto JSON, y a veces vienen rotos. Una
     * llamada ilegible se descarta y se sigue: vale más contestar sin acción
     * que reventar la petición entera.
     */
    try {
      const argumentos = JSON.parse(llamada.function.arguments || '{}') as Record<string, unknown>;
      llamadas.push({ nombre: llamada.function.name, argumentos });
    } catch {
      log.error('argumentos ilegibles', { herramienta: llamada.function.name });
    }
  }

  return { texto: (mensaje.content ?? '').trim(), llamadas };
}
