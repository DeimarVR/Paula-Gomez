import { FUNCIONES } from '@/lib/config';
import type { RespuestaDelAgente } from './tipos';
import { PANTALLAS, type Pantalla } from './herramientas';
import {
  fechaDeLaFrase,
  horaDeLaFrase,
  hoyEnLaClinica,
  loQueQueda,
  normalizar,
} from './lenguaje';

/**
 * El asistente sin inteligencia artificial.
 *
 * Existe para que el chat NUNCA quede muerto: si la IA está apagada, si se cae
 * Groq, si se acabó el tope de gasto o si tarda demasiado, estas reglas cubren
 * lo que se pide todos los días. No entiende matices; entiende órdenes.
 *
 * Con la IA encendida, estas reglas son el plan B y no el plan A: el modelo
 * entiende matices que ninguna lista de palabras clave va a cubrir. Pero
 * cubren de sobra lo que se pide a diario, así que un día sin Groq el panel
 * sigue siendo usable en vez de quedarse con un chat que solo pide perdón.
 *
 * Una regla devuelve null si no es lo suyo; se recorren en orden y gana la
 * primera que reconoce la frase. El orden importa: las consultas van antes que
 * «navegar», que es la más amplia y se las comería.
 */

type Regla = (frase: string, t: string) => RespuestaDelAgente | null;

const respuesta = (
  reply: string,
  action?: RespuestaDelAgente['action'],
  extra: Partial<RespuestaDelAgente> = {},
): RespuestaDelAgente => ({ reply, action, origen: 'reglas', ...extra });

/** Cómo se dice cada pantalla en el día a día del centro. */
const COMO_LA_LLAMAN: Array<[RegExp, Pantalla]> = [
  [/\b(inventario|productos?|stock|existencias?)\b/, 'inventario'],
  [/\b(citas?|agenda|agendamiento)\b/, 'citas'],
  // Con las fichas del centro anterior apagadas, «historias» y «fichas» son el expediente.
  [
    /\b(control de pacientes?|controles|historias?|fichas?|expedientes?)\b/,
    FUNCIONES.fichasClinicas ? 'control-pacientes' : 'pacientes',
  ],
  [/\b(horario de atencion|horario del centro|editar (el )?horario)\b/, 'horario'],
  [/\b(pacientes?)\b/, 'pacientes'],
  [/\b(consentimientos?|firmas?)\b/, 'consentimientos'],
  [/\b(fotos?|galeria|resultados?)\b/, 'fotos'],
  [/\b(tratamientos?|servicios?)\b/, 'tratamientos'],
  [/\b(mensajes?|contacto)\b/, 'mensajes'],
  [/\b(sitio|pagina|web|landing)\b/, 'sitio'],
  [/\b(inicio|panel|tablero|home)\b/, 'inicio'],
];

const VERBOS_IR = /\b(llevame|lleveme|ir|vamos|anda|abre(me)?|abrir|muestrame|muestra|ver|quiero ver|necesito ver|entra|ve)\b/;
const VERBOS_BUSCAR = /\b(busca(me)?|buscar|encuentra|encontrar|donde esta|dame)\b/;

const reglas: Regla[] = [
  /* ---- Saludos y qué sabe hacer ----------------------------------- */
  (_, t) => {
    if (!/^(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)\b/.test(t)) return null;
    return respuesta(
      'Hola. Puedo llevarte a cualquier pantalla, buscar pacientes, consultar la agenda y ' +
        'el inventario, y dejarte listos los formularios de cita o paciente. Dime qué necesitas.',
    );
  },
  (_, t) => {
    if (!/\b(que (puedes|sabes) hacer|ayuda|en que me ayudas|opciones)\b/.test(t)) return null;
    return respuesta(
      'Prueba con: «llévame a las citas», «busca a juan moncayo», «qué hay mañana», ' +
        '«qué hay que comprar», «agéndame a pedro mañana a las 3» o «entraron 5 kapilsan».',
    );
  },

  /* ---- Consultas ---------------------------------------------------- */
  (_, t) => {
    if (!/\b(que (hay que|tengo que|hace falta) (comprar|pedir)|que falta|esta(n)? (bajo|agotad))/.test(t)) {
      return null;
    }
    return respuesta('Esto es lo que está por debajo del mínimo.', {
      type: 'consultar_inventario',
      soloBajos: true,
    });
  },
  (frase, t) => {
    if (!/\b(cuantos?|cuanta|queda(n)?|hay)\b/.test(t) || !/\b(de|del)?\s*\w+/.test(t)) return null;
    if (!/\b(quedan?|hay|tenemos)\b/.test(t)) return null;
    const q = loQueQueda(frase, /\b(cuantos?|cuanta|quedan?|hay|tenemos|de|del|en inventario|me)\b/gi);
    if (q.length < 3) return null;
    return respuesta(`Busco «${q}» en el inventario.`, { type: 'consultar_inventario', q });
  },
  (frase, t) => {
    if (!/\b(agenda|citas?)\b/.test(t)) return null;
    if (!/\b(que hay|como esta|quien (viene|tengo)|agenda de|citas de)\b/.test(t)) return null;
    const fecha = fechaDeLaFrase(frase) ?? hoyEnLaClinica();
    return respuesta('Te muestro la agenda.', { type: 'consultar_agenda', fecha });
  },

  /* ---- Buscar ------------------------------------------------------- */
  /*
   * Tiene que haber un verbo de buscar o de abrir, no basta con que aparezca
   * la palabra «paciente».
   *
   * Sin esa exigencia, «saqué 2 minoxidil para un paciente» y «cuál es el
   * pronóstico de este paciente» entraban aquí y se convertían en una
   * búsqueda sin sentido. Lo atrapó la prueba: una regla que se dispara de
   * más es peor que una que se queda corta, porque la que se queda corta deja
   * pasar la frase al modelo y la otra se la roba.
   */
  (frase, t) => {
    if (!VERBOS_BUSCAR.test(t) && !VERBOS_IR.test(t)) return null;
    if (!/\b(paciente|historia|ficha)\b/.test(t)) return null;
    const q = loQueQueda(
      frase,
      VERBOS_BUSCAR,
      VERBOS_IR,
      /\b(el|la|al|a|de|del|paciente|historia|ficha|me|por favor)\b/gi,
    );
    if (q.length < 2) return null;
    return respuesta(`Busco a «${q}».`, { type: 'buscar_paciente', q });
  },

  /* ---- Rellenar formularios ---------------------------------------- */
  (frase, t) => {
    if (!/\b(cita|agenda(me|le)?|agendar|programa(r|me)?)\b/.test(t)) return null;
    if (!/\b(agenda(me|le|r)?|nueva|programa|crear|crea|pon(le|me)?)\b/.test(t)) return null;
    const fecha = fechaDeLaFrase(frase) ?? undefined;
    const hora = horaDeLaFrase(frase) ?? undefined;
    const paciente = nombreDespuesDe(frase, /\b(a|para)\b/);
    return respuesta('Te abro la cita con lo que entendí. Confirma el horario antes de guardar.', {
      type: 'nueva_cita',
      ...(paciente ? { paciente } : {}),
      ...(fecha ? { fecha } : {}),
      ...(hora ? { hora } : {}),
    });
  },
  (frase, t) => {
    if (!/\bpaciente\b/.test(t) || !/\b(nuevo|nueva|crear|crea|registra|agrega)\b/.test(t)) {
      return null;
    }
    const nombre = nombreDespuesDe(frase, /\b(paciente|llamad[oa])\b/);
    return respuesta('Te abro el formulario de paciente nuevo.', {
      type: 'nuevo_paciente',
      ...(nombre ? { nombre } : {}),
    });
  },

  /* ---- Inventario: escribir (pide confirmación) --------------------- */
  (frase, t) => {
    const entrada = /\b(entraron|llegaron|ingreso|ingresaron|compre|compramos|recibimos)\b/.test(t);
    const salida = /\b(saque|sacamos|salieron|se uso|usamos|gaste|gastamos)\b/.test(t);
    if (!entrada && !salida) return null;

    const cantidad = (frase.match(/\b(\d{1,4})\b/) ?? [])[1];
    if (!cantidad) return null;

    const producto = loQueQueda(
      frase,
      /\b(entraron|llegaron|ingreso|ingresaron|compre|compramos|recibimos|saque|sacamos|salieron|se uso|usamos|gaste|gastamos)\b/gi,
      /\b\d{1,4}\b/g,
      /\b(de|del|unidades?|cajas?|para|un|una|unos|unas|el|la|los|las)\b/gi,
    );
    if (producto.length < 2) return null;

    const tipo = entrada ? 'ENTRADA' : 'SALIDA';
    return respuesta(
      `Voy a registrar ${tipo === 'SALIDA' ? 'una salida' : 'una entrada'} de ${cantidad} de «${producto}». ¿Lo confirmo?`,
      { type: 'movimiento_inventario', producto, tipo, cantidad: Number(cantidad) },
      {
        necesitaConfirmar: true,
        resumen: `${tipo === 'SALIDA' ? 'Sacar' : 'Ingresar'} ${cantidad} de «${producto}».`,
      },
    );
  },

  /* ---- Navegar. Va de última: es la más amplia y se comería a las demás. */
  (frase, t) => {
    if (!VERBOS_IR.test(t) && !/^(inventario|citas|pacientes|agenda)$/.test(t)) {
      return null;
    }
    for (const [patron, pantalla] of COMO_LA_LLAMAN) {
      if (patron.test(t)) {
        return respuesta(`Te llevo a ${pantalla.replace('-', ' ')}.`, { type: 'navegar', pantalla });
      }
    }
    return null;
  },
];

/** El nombre que viene después de «a», «para», «el paciente»… */
function nombreDespuesDe(frase: string, marca: RegExp): string | undefined {
  const t = normalizar(frase);
  const encontrado = t.match(new RegExp(`${marca.source}\\s+([a-z\\s]{3,60}?)(?=\\s+(por|de|el|la|los|con|que|mañana|hoy|a las|\\d)|$)`, 'i'));
  const nombre = encontrado?.[2]?.trim();
  if (!nombre || nombre.length < 3) return undefined;
  // Palabras que no son nombres de persona por mucho que sigan a un «a».
  if (/^(las?|los?|un|una|el|mi|su|este|esta|ver|cobrar)\b/.test(nombre)) return undefined;
  return nombre;
}

/**
 * Lee la frase con las reglas. Devuelve null si ninguna la reconoce.
 *
 * Que devuelva null NO es un fallo: significa «esto no lo cubro, páselo a la
 * IA». Solo cuando la IA tampoco está se convierte en el mensaje de «no te
 * entendí».
 */
export function interpretar(frase: string): RespuestaDelAgente | null {
  const t = normalizar(frase);
  for (const regla of reglas) {
    const salida = regla(frase, t);
    if (salida) return salida;
  }
  return null;
}

/** Lo que se contesta cuando no hay IA y las reglas tampoco entendieron. */
export function noEntendi(): RespuestaDelAgente {
  return respuesta(
    'No te entendí. Puedo llevarte a una pantalla, buscar un paciente, consultar la ' +
      'agenda o el inventario, y dejarte listo un formulario. ' +
      'Prueba con «llévame a las citas» o «busca a juan moncayo».',
  );
}

export const PANTALLAS_VALIDAS = PANTALLAS;
