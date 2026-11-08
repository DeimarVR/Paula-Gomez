import { z } from 'zod';
import type { Herramienta } from './tipos';

/**
 * Lo que el asistente puede hacer en [NOMBRE_CLÍNICA].
 *
 * Una herramienta por acción, con su esquema de parámetros. La lista viaja al
 * modelo tal cual: lo que no está aquí, el asistente no lo puede hacer, y esa
 * es justamente la idea. Añadir una capacidad es añadir una entrada; no hay
 * forma de que el modelo se invente una.
 *
 * Las descripciones están escritas para el modelo, no para la pantalla: dicen
 * CUÁNDO usar cada una, porque elegir mal la herramienta es el error que más
 * se repite cuando hay varias parecidas.
 */

const texto = (descripcion: string) => ({ type: 'string', description: descripcion });

/** Una fecha en formato YYYY-MM-DD, que es como la entiende el resto del sistema. */
const fecha = (descripcion: string) => ({
  type: 'string',
  description: `${descripcion} En formato YYYY-MM-DD.`,
  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
});

const claveFecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe ir como YYYY-MM-DD');
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe ir como HH:MM');

/** Las pantallas a las que se puede llevar a alguien. */
export const PANTALLAS = {
  inicio: '/admin',
  citas: '/admin/citas',
  pacientes: '/admin/pacientes',
  'control-pacientes': '/admin/control-pacientes',
  inventario: '/admin/inventario',
  consentimientos: '/admin/consentimientos',
  fotos: '/admin/fotos',
  tratamientos: '/admin/tratamientos',
  mensajes: '/admin/mensajes',
  sitio: '/admin/sitio',
  horario: '/admin/horario',
} as const;

export type Pantalla = keyof typeof PANTALLAS;

export const HERRAMIENTAS: Herramienta[] = [
  /* ---------------------------------------------------------------- *
   * Moverse y buscar. Nada de esto cambia un dato.
   * ---------------------------------------------------------------- */
  {
    name: 'navegar',
    description:
      'Lleva a la persona a una pantalla del panel. Úsala cuando pida ver una sección completa ' +
      '(«llévame a inventario», «abre las citas», «quiero ver los pacientes»). Si pide algo concreto de ' +
      'esa sección, prefiere una herramienta de búsqueda.',
    riesgo: 'navegar',
    parameters: {
      type: 'object',
      properties: {
        pantalla: {
          type: 'string',
          enum: Object.keys(PANTALLAS),
          description: 'La sección del panel.',
        },
      },
      required: ['pantalla'],
    },
    esquema: z.object({
      pantalla: z.enum(Object.keys(PANTALLAS) as [Pantalla, ...Pantalla[]]),
    }),
  },
  {
    name: 'buscar_paciente',
    description:
      'Busca un paciente por nombre, documento o teléfono y abre su ficha. Úsala siempre que ' +
      'mencionen a una persona por su nombre y quieran verla, antes de cualquier otra acción ' +
      'sobre ese paciente.',
    riesgo: 'navegar',
    parameters: {
      type: 'object',
      properties: { q: texto('El nombre, documento o teléfono tal como lo dijo la persona.') },
      required: ['q'],
    },
    esquema: z.object({ q: z.string().trim().min(2).max(120) }),
  },
  {
    name: 'consultar_agenda',
    description:
      'Muestra las citas de un día. Úsala para «qué hay mañana», «cómo está la agenda del ' +
      'viernes». Si no dicen qué día, usa el de hoy.',
    riesgo: 'navegar',
    parameters: {
      type: 'object',
      properties: { fecha: fecha('El día que quieren ver.') },
      required: ['fecha'],
    },
    esquema: z.object({ fecha: claveFecha }),
  },
  {
    name: 'consultar_inventario',
    description:
      'Consulta el inventario. Sin filtros muestra todo; con `soloBajos` muestra lo que hay que ' +
      'pedir; con `q` busca un producto concreto. Úsala para «qué hay que comprar», «cuántos ' +
      'kapilsan quedan».',
    riesgo: 'navegar',
    parameters: {
      type: 'object',
      properties: {
        q: texto('Opcional: el nombre del producto.'),
        soloBajos: {
          type: 'boolean',
          description: 'true para ver solo lo que está por debajo del mínimo.',
        },
      },
    },
    esquema: z.object({
      q: z.string().trim().min(2).max(120).optional(),
      soloBajos: z.boolean().optional(),
    }),
  },

  /* ---------------------------------------------------------------- *
   * Rellenar un formulario. El asistente redacta, la persona guarda.
   * ---------------------------------------------------------------- */
  {
    name: 'nueva_cita',
    description:
      'Abre el formulario de cita nueva con lo que se sepa. NO la agenda: la persona confirma ' +
      'el horario disponible y guarda. Úsala para «agéndame a juan el martes a las 10».',
    riesgo: 'rellenar',
    parameters: {
      type: 'object',
      properties: {
        paciente: texto('Nombre del paciente.'),
        fecha: fecha('El día de la cita.'),
        hora: { type: 'string', description: 'La hora en formato HH:MM, 24 horas.' },
        motivo: texto('El motivo o el tratamiento, si lo dijeron.'),
      },
    },
    esquema: z.object({
      paciente: z.string().trim().max(160).optional(),
      fecha: claveFecha.optional(),
      hora: hora.optional(),
      motivo: z.string().trim().max(200).optional(),
    }),
  },
  {
    name: 'nuevo_paciente',
    description:
      'Abre el formulario de paciente nuevo con los datos que hayan dicho. NO lo crea.',
    riesgo: 'rellenar',
    parameters: {
      type: 'object',
      properties: {
        nombre: texto('Nombre completo.'),
        documento: texto('Número de documento.'),
        telefono: texto('Teléfono de contacto.'),
      },
    },
    esquema: z.object({
      nombre: z.string().trim().max(160).optional(),
      documento: z.string().trim().max(40).optional(),
      telefono: z.string().trim().max(40).optional(),
    }),
  },

  /* ---------------------------------------------------------------- *
   * Escribir de verdad. Siempre con confirmación.
   * ---------------------------------------------------------------- */
  {
    name: 'movimiento_inventario',
    description:
      'Registra una entrada o una salida de un producto. Úsala para «entraron 5 kapilsan», ' +
      '«saqué 2 minoxidil para un paciente». La cantidad va siempre positiva; el sentido lo ' +
      'da el tipo.',
    riesgo: 'escribir',
    parameters: {
      type: 'object',
      properties: {
        producto: texto('El nombre del producto tal como lo dijeron.'),
        tipo: { type: 'string', enum: ['ENTRADA', 'SALIDA'], description: 'Si entra o sale.' },
        cantidad: { type: 'integer', description: 'Cuántas unidades, siempre en positivo.' },
        motivo: {
          type: 'string',
          enum: ['COMPRA', 'USO_EN_PACIENTE', 'DEVOLUCION', 'VENCIMIENTO', 'DANO', 'OTRO'],
          description: 'Por qué se mueve.',
        },
      },
      required: ['producto', 'tipo', 'cantidad'],
    },
    esquema: z.object({
      producto: z.string().trim().min(2).max(160),
      tipo: z.enum(['ENTRADA', 'SALIDA']),
      cantidad: z.number().int().min(1).max(10_000),
      motivo: z
        .enum(['COMPRA', 'USO_EN_PACIENTE', 'DEVOLUCION', 'VENCIMIENTO', 'DANO', 'OTRO'])
        .optional(),
    }),
    confirmacion: (p) =>
      `${p.tipo === 'SALIDA' ? 'Sacar' : 'Ingresar'} ${p.cantidad} de «${p.producto}».`,
  },
  /*
   * Aquí iría `cambiar_estado_cita` —confirmar, marcar atendida, cancelar— y
   * NO está a propósito.
   *
   * Para ejecutarla hay que resolver primero de qué cita habla la frase, y con
   * dos pacientes que se llaman parecido o dos citas el mismo día eso se
   * equivoca. Una cita cancelada por error es un paciente que llega a una
   * puerta cerrada. Mientras no exista una forma de que la persona elija la
   * cita exacta antes de confirmar, el asistente la lleva a la agenda y la
   * cambia ella, que son dos clics.
   *
   * Una herramienta que el modelo puede pedir pero nada sabe ejecutar es peor
   * que no tenerla: el chat promete y no cumple.
   */
];

/** Para buscar una herramienta por su nombre sin recorrer la lista cada vez. */
export const POR_NOMBRE = new Map(HERRAMIENTAS.map((h) => [h.name, h]));

/**
 * Las herramientas que puede usar un rol.
 *
 * Esto NO es la seguridad: la seguridad son los `requireRole` de cada ruta,
 * que siguen ahí. Esto evita que el modelo le proponga a recepción una acción
 * que le va a rebotar, que para quien la pide se ve como que el asistente no
 * sirve.
 */
export function herramientasDe(rol: string): Herramienta[] {
  return HERRAMIENTAS.filter((h) => !h.roles || h.roles.includes(rol as never));
}

/** La lista en el formato que espera la API de Groq. */
export function paraElModelo(herramientas: Herramienta[]) {
  return herramientas.map((h) => ({
    type: 'function' as const,
    function: { name: h.name, description: h.description, parameters: h.parameters },
  }));
}
