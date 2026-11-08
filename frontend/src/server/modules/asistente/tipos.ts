import { z } from 'zod';

/**
 * El contrato del asistente.
 *
 * Una petición trae lo que escribió la persona y lo que ya se dijo en la
 * conversación; la respuesta trae lo que el asistente contesta y, si hace
 * falta, UNA acción para que la ejecute la pantalla.
 *
 * El modelo nunca escribe en la base. Decide qué acción corresponde y con qué
 * parámetros; el servidor la valida y la pantalla la ejecuta. Es lo que
 * permite que una respuesta rara del modelo sea, como mucho, una acción que no
 * se aplica — nunca una factura inventada.
 */

/* ------------------------------------------------------------------ *
 * Qué tan lejos llega cada acción
 * ------------------------------------------------------------------ */

/**
 * El riesgo de una acción no es una etiqueta decorativa: decide si se ejecuta
 * sola o si hay que confirmarla.
 *
 *  - `navegar`  no cambia nada. Llevar a una pantalla, abrir una ficha,
 *               buscar. Se ejecuta de una.
 *  - `rellenar` abre un formulario con los campos ya puestos, y la persona
 *               revisa y guarda. El asistente redacta; el guardado es humano.
 *               Aquí cae casi todo lo de «crear».
 *  - `escribir` toca la base de verdad. Pide confirmación explícita en el
 *               chat antes de hacerse, con el resumen de lo que va a pasar.
 *
 * La regla de fondo: nada que mueva plata, inventario o la agenda de un
 * paciente ocurre sin que alguien del centro lo haya visto escrito y dicho
 * que sí. Un modelo que entiende mal «cancela la de las 3» y cancela la cita
 * equivocada cuesta un paciente.
 */
export type Riesgo = 'navegar' | 'rellenar' | 'escribir';

/** Quién puede pedir cada acción. Se comprueba en el servidor, no en el chat. */
export type RolPermitido = 'ADMIN' | 'PROFESIONAL' | 'RECEPCION';

export interface Herramienta {
  /** El nombre que ve el modelo y que viaja en `action.type`. */
  name: string;
  /** Para qué sirve, escrito para que lo entienda el modelo. */
  description: string;
  /** Qué parámetros acepta, en JSON Schema: es lo que entiende Groq. */
  parameters: Record<string, unknown>;
  riesgo: Riesgo;
  /** Vacío = cualquiera con sesión. */
  roles?: RolPermitido[];
  /** Valida y normaliza lo que devuelve el modelo. */
  esquema: z.ZodTypeAny;
  /**
   * El resumen que se le enseña a la persona antes de confirmar.
   * Solo para las de riesgo `escribir`.
   */
  confirmacion?: (params: Record<string, unknown>) => string;
}

export interface AccionDelAgente {
  type: string;
  [param: string]: unknown;
}

export interface RespuestaDelAgente {
  /** Lo que el asistente le dice a la persona. Siempre va, haya acción o no. */
  reply: string;
  action?: AccionDelAgente;
  /** true cuando la acción es de escribir y falta el sí de la persona. */
  necesitaConfirmar?: boolean;
  /** Qué se le enseña antes de confirmar. */
  resumen?: string;
  /** De dónde salió la respuesta. Sirve para depurar, no se le enseña a nadie. */
  origen: 'ia' | 'reglas';
}

export const mensajeSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(4000),
});

export type Mensaje = z.infer<typeof mensajeSchema>;

export const peticionSchema = z.object({
  message: z.string().trim().min(1, 'Escribe algo').max(2000),
  /**
   * Solo los últimos turnos. El historial completo de una tarde entera no
   * mejora la respuesta y sí multiplica lo que se paga por cada mensaje.
   */
  history: z.array(mensajeSchema).max(12).default([]),
  /** Dónde está parada la persona. Ayuda a resolver «bórrala», «ábrela». */
  pantalla: z.string().max(120).optional(),
  /** Vuelve con el sí de la persona para ejecutar una acción de escritura. */
  confirmar: z
    .object({
      type: z.string().max(60),
      params: z.record(z.unknown()).default({}),
    })
    .optional(),
});

export type Peticion = z.infer<typeof peticionSchema>;
