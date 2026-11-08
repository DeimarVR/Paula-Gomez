import { z } from 'zod';
import { createLogger } from '@/server/lib/logger';
import { HttpError } from '@/server/lib/httpError';
import { ESPERA, ErrorDeIA, iaDisponible, preguntarle } from './groq';

const log = createLogger('asistente');

/**
 * Redactar con ayuda de la IA.
 *
 * Es la otra mitad del asistente: no ejecuta nada, solo escribe. Sirve para
 * los textos del sitio, para un mensaje a un paciente o para la descripción de
 * un tratamiento. Lo que sale de aquí SIEMPRE lo revisa una persona antes de
 * publicarse o enviarse; no hay ningún camino en el que un texto generado
 * llegue solo a un paciente.
 */

export const ACCIONES = ['generar', 'mejorar', 'acortar', 'alargar'] as const;
export type AccionDeTexto = (typeof ACCIONES)[number];

export const textoSchema = z.object({
  accion: z.enum(ACCIONES),
  /** De qué se escribe. Obligatorio al generar; al mejorar sale del texto. */
  tema: z.string().trim().max(600).optional(),
  /** El texto que ya existe. Obligatorio para mejorar, acortar y alargar. */
  texto: z.string().trim().max(6000).optional(),
  tono: z.enum(['cercano', 'profesional', 'informativo']).default('cercano'),
  publico: z.string().trim().max(120).optional(),
  formato: z.enum(['parrafo', 'lista', 'mensaje']).default('parrafo'),
  /** Tope de caracteres de la respuesta. Se recorta en el servidor. */
  largo: z.coerce.number().int().min(80).max(3000).default(700),
});

export type PeticionDeTexto = z.infer<typeof textoSchema>;

export const ideasSchema = z.object({
  tema: z.string().trim().min(3).max(300),
  cantidad: z.coerce.number().int().min(2).max(10).default(6),
});

const COMO_SUENA: Record<PeticionDeTexto['tono'], string> = {
  cercano: 'Cercano y natural, como habla alguien del centro con un paciente. De usted no, de tú.',
  profesional: 'Sobrio y profesional, sin sonar frío ni acartonado.',
  informativo: 'Informativo y directo, explicando sin adornos.',
};

const COMO_SE_VE: Record<PeticionDeTexto['formato'], string> = {
  parrafo: 'Uno o dos párrafos corridos. Sin títulos ni viñetas.',
  lista: 'Una lista de puntos cortos, uno por línea, empezando cada uno con «- ».',
  mensaje: 'Un mensaje para enviar por WhatsApp. Corto, sin asunto ni firma.',
};

/** Las reglas de escritura, iguales para todo lo que se genera. */
const COMO_ESCRIBIR = [
  'ESCRIBE ASÍ',
  '- En español de Colombia, natural y cotidiano. Como habla la gente, no como escribe un folleto.',
  '- Palabras comunes. Nada de «potenciar», «optimizar», «integral», «vanguardia», «solución».',
  '- Frases cortas. Si una frase se puede decir con menos palabras, dila con menos.',
  '- Sin emojis, salvo que el texto original ya los use.',
  '',
  'NO HAGAS ESTO',
  '- No inventes datos: ni precios, ni cifras, ni plazos, ni nombres, ni resultados.',
  '- No prometas resultados de un tratamiento ni des consejo médico.',
  '- No te salgas del tema que te dieron ni añadas ideas que nadie pidió.',
  '- No expliques lo que hiciste. Devuelve solo el texto, sin preámbulo ni comillas.',
].join('\n');

function encargo(p: PeticionDeTexto): string {
  const partes: string[] = [];

  if (p.accion === 'generar') {
    partes.push(`Escribe un texto sobre: ${p.tema}`);
  } else {
    const verbo = {
      mejorar: 'Reescribe este texto para que se lea mejor, sin cambiar lo que dice',
      acortar: 'Acorta este texto dejando lo esencial',
      alargar: 'Desarrolla este texto con un poco más de detalle, sin añadir datos nuevos',
    }[p.accion];
    partes.push(`${verbo}:`, '', p.texto ?? '');
    if (p.tema) partes.push('', `Contexto: ${p.tema}`);
  }

  partes.push(
    '',
    `Tono: ${COMO_SUENA[p.tono]}`,
    `Formato: ${COMO_SE_VE[p.formato]}`,
    p.publico ? `Para quién es: ${p.publico}` : '',
    `Largo máximo: unos ${p.largo} caracteres.`,
  );

  return partes.filter(Boolean).join('\n');
}

/**
 * Limpia lo que devuelve el modelo antes de que nadie lo vea.
 *
 * Los modelos envuelven el texto en comillas, lo presentan con un «Aquí
 * tienes:» o lo rematan con un ofrecimiento de ayuda. Nada de eso es el texto
 * que se pidió, así que se quita aquí y no en la pantalla: la pantalla no
 * tiene por qué saber las mañas del modelo.
 */
export function limpiarTexto(bruto: string, largo: number): string {
  let limpio = bruto.trim();

  limpio = limpio.replace(
    /^(aqu[ií] (tienes|va|te dejo)|claro|por supuesto|perfecto)[^\n:]*:\s*/i,
    '',
  );
  limpio = limpio.replace(/^```[a-z]*\n?|\n?```$/g, '');
  if (/^["«“].*["»”]$/s.test(limpio)) limpio = limpio.slice(1, -1);
  limpio = limpio.replace(
    /\n+\s*(¿(te sirve|quieres|necesitas)|si (quieres|necesitas))[^\n]*$/i,
    '',
  );
  limpio = limpio.replace(/\n{3,}/g, '\n\n').trim();

  if (limpio.length > largo) {
    /* Se corta en el último punto que quepa, no a mitad de palabra. */
    const recorte = limpio.slice(0, largo);
    const corte = Math.max(recorte.lastIndexOf('. '), recorte.lastIndexOf('\n'));
    limpio = (corte > largo * 0.5 ? recorte.slice(0, corte + 1) : recorte).trim();
  }

  return limpio;
}

export async function generarTexto(p: PeticionDeTexto): Promise<string> {
  if (!iaDisponible()) {
    throw HttpError.unprocessable('La ayuda de IA está apagada.');
  }
  if (p.accion === 'generar' && !p.tema) {
    throw HttpError.unprocessable('Dime sobre qué quieres que escriba.');
  }
  if (p.accion !== 'generar' && !p.texto) {
    throw HttpError.unprocessable('No hay texto que trabajar.');
  }

  const salida = await preguntarle({
    mensajes: [
      { role: 'system', content: COMO_ESCRIBIR },
      { role: 'user', content: encargo(p) },
    ],
    espera: ESPERA.texto,
    temperatura: 0.6,
    maxTokens: 1400,
  });

  const limpio = limpiarTexto(salida.texto, p.largo);
  if (!limpio) throw HttpError.unprocessable('La IA devolvió un texto vacío. Inténtalo otra vez.');
  return limpio;
}

/**
 * Una tanda de ideas cortas. Semillas, no textos terminados.
 *
 * Devuelve frases para arrancar, que es lo que hace falta cuando alguien se
 * queda mirando un campo vacío. Si devolviera textos completos, nadie los
 * leería y se publicarían tal cual.
 */
export async function generarIdeas(tema: string, cantidad = 6): Promise<string[]> {
  if (!iaDisponible()) throw HttpError.unprocessable('La ayuda de IA está apagada.');

  const salida = await preguntarle({
    mensajes: [
      { role: 'system', content: COMO_ESCRIBIR },
      {
        role: 'user',
        content: [
          `Dame ${cantidad} ideas cortas sobre: ${tema}`,
          '',
          'Cada idea en una línea, empezando con «- ».',
          'Una línea de ocho a quince palabras. Son puntos de partida, no textos terminados.',
          'Que cada una diga algo distinto: si dos se parecen, cambia una.',
        ].join('\n'),
      },
    ],
    espera: ESPERA.ideas,
    temperatura: 0.9,
    maxTokens: 700,
  });

  return normalizarIdeas(salida.texto, cantidad);
}

/**
 * Convierte la respuesta del modelo en una lista de verdad.
 *
 * Quita las viñetas y la numeración, descarta vacías y repetidas, y recorta
 * las que se fueron de largo. La comparación para detectar repetidas ignora
 * tildes y mayúsculas, porque es exactamente ahí donde el modelo disfraza la
 * misma idea dos veces.
 */
export function normalizarIdeas(bruto: string, cantidad: number): string[] {
  const vistas = new Set<string>();
  const ideas: string[] = [];

  for (const linea of bruto.split('\n')) {
    const limpia = linea
      .replace(/^\s*(?:[-*•–]|\d+[.)])\s*/, '')
      .replace(/^["«“]|["»”]$/g, '')
      .trim();

    if (limpia.length < 8) continue;
    if (/^(aqu[ií] (tienes|van)|claro|por supuesto)/i.test(limpia)) continue;

    const huella = limpia
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/g, '')
      .trim();
    if (vistas.has(huella)) continue;
    vistas.add(huella);

    ideas.push(limpia.length > 160 ? `${limpia.slice(0, 157).trimEnd()}…` : limpia);
    if (ideas.length >= cantidad) break;
  }

  if (ideas.length === 0) {
    log.error('el modelo no devolvió ninguna idea aprovechable');
    throw HttpError.unprocessable('La IA no devolvió ideas útiles. Inténtalo otra vez.');
  }

  return ideas;
}

/** Traduce un fallo de la IA a una frase corta para la pantalla. */
export function comoSeLoDigo(fallo: unknown): HttpError {
  if (fallo instanceof HttpError) return fallo;
  if (fallo instanceof ErrorDeIA) {
    return HttpError.unprocessable(
      fallo.causa === 'timeout'
        ? 'La IA tardó demasiado. Inténtalo otra vez.'
        : 'La IA no está disponible ahora mismo.',
    );
  }
  log.error('fallo inesperado al generar', { detalle: String(fallo).slice(0, 300) });
  return HttpError.unprocessable('No pudimos generar el texto. Inténtalo otra vez.');
}
