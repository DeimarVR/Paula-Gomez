import { CITA } from '@/lib/agenda';
import { env } from '@/server/config/env';
import { createLogger } from '@/server/lib/logger';
import { ESPERA, ErrorDeIA, iaDisponible, preguntarle, type MensajeGroq } from './groq';
import { herramientasDe, paraElModelo, POR_NOMBRE } from './herramientas';
import { fechaDeLaFrase, horaDeLaFrase, hoyEnLaClinica, plataDeLaFrase } from './lenguaje';
import { interpretar, noEntendi } from './reglas';
import type { Peticion, RespuestaDelAgente } from './tipos';

const log = createLogger('asistente');

/**
 * El asistente del panel.
 *
 * Dos modos, y el orden importa: si la IA está encendida se le pregunta a
 * ella, porque entiende matices que ninguna lista de palabras clave cubre. Si
 * está apagada, si falla, si tarda o si se acabó el tope del día, mandan las
 * reglas. El chat nunca se queda mudo.
 *
 * Lo que el modelo NO hace, y esto es el diseño entero: no lee la base de
 * datos ni escribe en ella. Recibe lo que escribió la persona y devuelve QUÉ
 * acción corresponde y con qué parámetros. La búsqueda, el guardado y los
 * permisos siguen pasando por las rutas de siempre, con su `requireRole` y sus
 * validaciones. Una alucinación del modelo es, como mucho, una acción que no
 * se aplica.
 */

/** Lo único que viaja a Groq además de lo que la persona escribió. */
function instrucciones(rol: string, pantalla?: string): string {
  return [
    'Eres el asistente del panel de [NOMBRE_CLÍNICA], un consultorio médico en [CIUDAD], Colombia, con una sola especialista y citas de 75 minutos.',
    'Hablas con el equipo del centro, no con pacientes.',
    '',
    'CÓMO RESPONDES',
    '- Siempre en español, en el tono de un compañero de trabajo: breve, claro y cotidiano.',
    '- Una o dos frases. Nada de listas largas ni de explicar lo que vas a hacer antes de hacerlo.',
    '- Si usas una herramienta, el texto acompaña la acción; no la repite ni la describe paso a paso.',
    '',
    'QUÉ HACES',
    '- Para cualquier cosa que se pueda hacer con una herramienta, úsala. No expliques cómo hacerlo a mano.',
    '- Si falta un dato para la herramienta, pregunta por ese dato y no uses la herramienta todavía.',
    '- Si piden algo que ninguna herramienta cubre, dilo en una frase. No lo inventes.',
    '',
    'QUÉ NO HACES',
    '- No das consejo médico, ni diagnósticos, ni dosis, ni pronósticos. Eso lo decide la profesional.',
    '- No te inventas precios, saldos, existencias ni fechas: no ves la base de datos. Si preguntan un dato, usa la herramienta de consulta que corresponda.',
    '- No prometes resultados de ningún tratamiento.',
    '',
    'LA AGENDA',
    `- Hay un solo tipo de cita: ${CITA.nombre.toLowerCase()} de ${CITA.duracionMin} minutos, una persona a la vez. No preguntes por el tratamiento para agendar.`,
    '- Un día se puede cerrar completo desde la Agenda; eso lo hace la persona, no tú.',
    '',
    `Hoy es ${hoyEnLaClinica()}. La zona horaria del centro es ${env.CLINIC_TIMEZONE}.`,
    `Quien te escribe tiene el rol ${rol}.`,
    pantalla ? `Ahora mismo está en la pantalla «${pantalla}».` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Arregla lo que el modelo escribió mal antes de descartarlo.
 *
 * Pasa constantemente: se le pide una fecha en YYYY-MM-DD y contesta «mañana»,
 * o un valor en pesos y contesta «64 mil». Tirar la acción por eso sería
 * perder una orden que se entendió bien. Se traduce aquí y, si aun así no
 * cuadra, entonces sí se descarta.
 */
function enderezar(params: Record<string, unknown>): Record<string, unknown> {
  const limpio: Record<string, unknown> = { ...params };

  if (typeof limpio.fecha === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(limpio.fecha)) {
    const leida = fechaDeLaFrase(limpio.fecha);
    if (leida) limpio.fecha = leida;
    else delete limpio.fecha;
  }

  if (typeof limpio.hora === 'string' && !/^\d{2}:\d{2}$/.test(limpio.hora)) {
    const leida = horaDeLaFrase(limpio.hora);
    if (leida) limpio.hora = leida;
    else delete limpio.hora;
  }

  for (const campo of ['valor', 'cantidad'] as const) {
    if (typeof limpio[campo] === 'string') {
      const leido = plataDeLaFrase(limpio[campo] as string);
      if (leido !== null) limpio[campo] = leido;
      else delete limpio[campo];
    }
  }

  // Una cadena vacía es un campo que el modelo no supo llenar, no un valor.
  for (const [clave, valor] of Object.entries(limpio)) {
    if (typeof valor === 'string' && valor.trim() === '') delete limpio[clave];
  }

  return limpio;
}

/** Lo que se le dice a la persona cuando la IA no pudo. Corto y sin detalles. */
function disculpa(causa: ErrorDeIA['causa']): string {
  if (causa === 'timeout') return 'La IA tardó demasiado. Inténtalo otra vez.';
  return 'La IA no está disponible ahora mismo.';
}

export interface Contexto {
  rol: string;
  /** Lo llama la ruta antes de gastar; devuelve false si se pasó del tope. */
  reservarCupo?: () => Promise<boolean>;
  /** Lo llama la ruta si la llamada falló, para no cobrar lo que no se usó. */
  devolverCupo?: () => Promise<void>;
}

export async function responder(
  peticion: Peticion,
  contexto: Contexto,
): Promise<RespuestaDelAgente> {
  const disponibles = herramientasDe(contexto.rol);

  /* ---- Reglas, cuando no hay IA ------------------------------------- */
  if (!iaDisponible()) {
    return interpretar(peticion.message) ?? noEntendi();
  }

  /* ---- Tope de gasto ------------------------------------------------ */
  if (contexto.reservarCupo && !(await contexto.reservarCupo())) {
    log.error('tope de IA alcanzado');
    const porReglas = interpretar(peticion.message);
    if (porReglas) return porReglas;
    return {
      reply:
        'Se alcanzó el tope de uso de la IA. Puedo seguir con lo básico: llevarte a una ' +
        'pantalla, buscar un paciente y consultar la agenda o el inventario.',
      origen: 'reglas',
    };
  }

  /* ---- Modo IA ------------------------------------------------------ */
  const mensajes: MensajeGroq[] = [
    { role: 'system', content: instrucciones(contexto.rol, peticion.pantalla) },
    ...peticion.history.map((m) => ({ role: m.role, content: m.content }) as MensajeGroq),
    { role: 'user', content: peticion.message },
  ];

  try {
    const salida = await preguntarle({
      mensajes,
      herramientas: paraElModelo(disponibles),
      espera: ESPERA.accion,
      temperatura: 0.2,
    });

    /*
     * Solo la primera llamada. El modelo a veces propone tres acciones de
     * golpe, y en un panel donde cada acción cambia de pantalla eso es un
     * desastre: se hace una, se ve el resultado, y se sigue.
     */
    const llamada = salida.llamadas[0];
    if (!llamada) {
      return {
        reply: salida.texto || 'No estoy seguro de qué necesitas. ¿Me lo dices de otra forma?',
        origen: 'ia',
      };
    }

    const herramienta = POR_NOMBRE.get(llamada.nombre);
    if (!herramienta || !disponibles.includes(herramienta)) {
      log.error('el modelo pidió una herramienta que no existe o no le toca', {
        herramienta: llamada.nombre,
        rol: contexto.rol,
      });
      return {
        reply: salida.texto || 'Eso no lo puedo hacer desde aquí.',
        origen: 'ia',
      };
    }

    const validado = herramienta.esquema.safeParse(enderezar(llamada.argumentos));
    if (!validado.success) {
      log.error('parámetros inválidos del modelo', {
        herramienta: llamada.nombre,
        fallo: validado.error.issues[0]?.message,
      });
      return {
        reply:
          salida.texto ||
          'Me falta un dato para hacer eso. ¿Me lo dices completo?',
        origen: 'ia',
      };
    }

    const params = validado.data as Record<string, unknown>;
    const action = { type: herramienta.name, ...params };

    if (herramienta.riesgo === 'escribir') {
      const resumen = herramienta.confirmacion?.(params) ?? 'Esta acción cambia datos.';
      return {
        reply: salida.texto || `${resumen} ¿Lo confirmo?`,
        action,
        necesitaConfirmar: true,
        resumen,
        origen: 'ia',
      };
    }

    return { reply: salida.texto || 'Listo.', action, origen: 'ia' };
  } catch (fallo) {
    await contexto.devolverCupo?.();

    const causa = fallo instanceof ErrorDeIA ? fallo.causa : 'proveedor';
    log.error('el agente cayó al respaldo', { causa, detalle: String(fallo).slice(0, 200) });

    /*
     * Si las reglas entienden la frase, se contesta como si nada: a quien
     * pregunta no le importa qué motor la atendió. El aviso de que la IA falló
     * solo aparece cuando tampoco las reglas pueden.
     */
    const porReglas = interpretar(peticion.message);
    if (porReglas) return porReglas;

    return { reply: disculpa(causa), origen: 'reglas' };
  }
}
