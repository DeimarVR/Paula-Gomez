/**
 * Configuración del sitio.
 *
 * Los datos de contacto reales llegan desde la API (`/api/public/clinic`);
 * lo de aquí es el respaldo para que la web renderice aunque el backend no
 * esté disponible, más las constantes puramente editoriales.
 */

/**
 * Funciones que se pueden apagar sin quitar el código.
 *
 * APAGAR NO ES BORRAR: esto solo esconde pantallas y enlaces. Los modelos, las
 * rutas y los servicios siguen en el repositorio, listos para volver a
 * encenderse cambiando el valor a `true`.
 *
 * Es a propósito: el centro quiere retomar el seguimiento del paciente más
 * adelante, y tirar el código para reescribirlo dentro de tres meses es peor
 * negocio que dejarlo dormido y anotado.
 */
export const FUNCIONES = {
  /**
   * Portal del paciente: /seguimiento/<token>, su enlace en el panel, la
   * sección de la portada y el enlace del menú.
   *
   * Apagado mientras deciden cómo lo van a usar. Ojo: lo que lo alimentaba era
   * la pantalla de planes y sesiones, que se BORRÓ porque duplicaba el Control
   * de pacientes. Los modelos y el servicio siguen en el repositorio, así que
   * encenderlo hoy mostraría una página vacía: para revivirlo hay que apuntar
   * el portal a la ficha de control.
   */
  seguimientoPaciente: false,

  /**
   * Fichas capilar y facial («Control de pacientes»): el formato del centro
   * anterior, con su diagrama de cabeza, sus sesiones y sus próximos
   * controles.
   *
   * Apagadas: este centro trabaja con el Expediente general (qué se trata,
   * medicación, antecedentes, notas y hojas en papel). El código, las rutas y
   * las tablas siguen ahí; encender esto vuelve a mostrar el menú, las fichas
   * en el perfil del paciente y sus filtros en el historial.
   */
  fichasClinicas: false,
} as const;

/**
 * Identificación legal del centro.
 *
 * Va aparte de `SITE` porque no es lo mismo el nombre comercial que la persona
 * jurídica: «[NOMBRE_CLÍNICA]» es la marca, y lo que la ley exige mostrar —y a
 * quien un paciente le reclama— es la razón social con su NIT.
 *
 * PENDIENTE DE LLENAR. Mientras estos campos estén vacíos, el pie del sitio y
 * la política de datos simplemente omiten la línea: se ven bien, pero al
 * centro le falta la identificación que la ley pide mostrar. Llenarlos con lo
 * que figura en el certificado de cámara de comercio.
 */
export const LEGAL = {
  /** Ej.: «[NOMBRE_CLÍNICA] S.A.S.» — como figura en la cámara de comercio. */
  razonSocial: '',
  /** Ej.: «901.234.567-8», con dígito de verificación. */
  nit: '',
  /** Correo para ejercer derechos sobre los datos (habeas data). */
  correoDatos: '[CORREO_DATOS]',
} as const;

/** `true` cuando ya se pueden mostrar los datos legales. */
export const legalCompleto = Boolean(LEGAL.razonSocial && LEGAL.nit);

export const SITE = {
  name: '[NOMBRE_CLÍNICA]',
  /**
   * Cómo firma el centro sus mensajes a pacientes.
   *
   * Va aparte de `name` porque no es la misma palabra: en la web y en el
   * logo es «[NOMBRE_CLÍNICA]», y por WhatsApp llevan años escribiendo
   * «[NOMBRE_CLÍNICA]». El mensaje automático tiene que sonar a ellos, no a
   * nosotros, así que aquí manda su costumbre y no nuestra coherencia.
   */
  nombreEnMensajes: '[NOMBRE_CLÍNICA]',
  tagline: 'Atención médica con cita previa',
  city: '[CIUDAD]',
  description:
    'Consulta con cita previa en [CIUDAD]. Agende en línea, reciba la confirmación por WhatsApp y un recordatorio el día anterior.',
  // `||`: una variable vacía en el .env daría '' y `new URL('')` lanza.
  url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
  instagram: '[INSTAGRAM]',
  instagramUrl: '#',
  /** Respaldo. El número real viene de CLINIC_WHATSAPP en el backend. */
  whatsappFallback: '573000000000',
  addressFallback: '[DIRECCIÓN]',
} as const;

/**
 * Redes del centro.
 *
 * Viven aquí y no en la API porque son enlaces de marca, no datos que cambien
 * con la operación. Si algún día hay que editarlos desde el panel, el sitio
 * donde tocarlos es el modelo `Setting` del backend.
 */
export const SOCIAL = [
  {
    id: 'instagram',
    label: 'Instagram',
    handle: '[INSTAGRAM]',
    url: '#',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    handle: '[FACEBOOK]',
    url: '#',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    handle: '[TIKTOK]',
    url: '#',
  },
] as const;

/**
 * Navegación principal: anclas de la portada, como en la maqueta. Desde
 * cualquier otra página llevan a la portada y bajan a la sección.
 */
export const NAV_LINKS = [
  { href: '/#servicios', label: 'Servicios' },
  { href: '/#especialista', label: 'Quién le atiende' },
  { href: '/#su-cita', label: 'Su cita' },
  { href: '/#visitenos', label: 'Visítenos' },
  { href: '/#preguntas', label: 'Preguntas' },
] as const;

/**
 * La portada, en palabras. Es el texto de la maqueta aprobada; se cambia aquí
 * sin tocar las secciones.
 */
export const PORTADA = {
  etiqueta: 'Consulta con cita previa',
  /** El final del titular va en cursiva y en azul. */
  titulo: 'Su salud, atendida con calma y',
  tituloResaltado: 'cada detalle en orden.',
  entrada:
    'Agende en línea, reciba la confirmación por WhatsApp y un recordatorio el día anterior. Su historia queda registrada en un solo lugar, para que cada consulta empiece donde terminó la anterior.',
} as const;

/** La franja de cifras debajo de la portada: lo que el paciente puede esperar. */
export const VALORES = [
  { cifra: '2', unidad: 'clics', texto: 'para reservar desde el celular, sin llamar ni esperar respuesta.' },
  { cifra: '75', unidad: 'minutos', texto: 'de consulta, una persona a la vez. Sin salas llenas ni prisa.' },
  { cifra: '24', unidad: 'horas antes', texto: 'le escribimos por WhatsApp para confirmar su cita.' },
  { cifra: '1', unidad: 'expediente', texto: 'con su historial, lo que está tomando y cada nota de evolución.' },
] as const;

/** «Su cita, paso a paso», en la sección oscura. */
export const PASOS_DE_LA_CITA = [
  {
    titulo: 'Elija día y hora',
    texto: 'En línea, con los horarios que de verdad están libres. Sin esperar a que le contesten.',
  },
  {
    titulo: 'Reciba la confirmación',
    texto: 'Un mensaje con la fecha, la hora y la dirección exacta de la sede, al instante.',
  },
  {
    titulo: 'Le recordamos la víspera',
    texto: 'Un día antes le escribimos para confirmar. Si no puede venir, cambia la hora desde el mismo enlace.',
  },
  {
    titulo: 'Si se libera antes, le avisamos',
    texto: 'Cuando alguien cancela, le ofrecemos ese espacio a quien tiene cita más adelante. Si le sirve, la adelanta con un toque.',
  },
] as const;

/**
 * Quién dirige el centro.
 *
 * El texto es el que ella misma escribió, palabra por palabra. Es su
 * trayectoria y su forma de contarla: aquí no se reescribe, solo se maqueta.
 * Si quiere cambiarlo, se cambia en este archivo y no hay que tocar la
 * sección.
 */
export const ESPECIALISTA = {
  nombre: '[NOMBRE_ESPECIALISTA]',
  /** Una línea debajo del nombre: especialidad y registro. */
  especialidad: '[ESPECIALIDAD] · Registro médico [00000]',
  /** Formación, experiencia, asociaciones. Cada una en su tarjeta. */
  cargos: [
    '[Título y universidad]',
    '[Especialización o posgrado]',
    '[Años de experiencia]',
    '[Asociaciones y certificaciones]',
  ],
  /** Una frase suya, en cursiva al final de su presentación. Vacía = no se muestra. */
  frase: '[Cada paciente llega con una historia. Mi trabajo empieza por escucharla.]',
  // Lista abierta y no tupla: el sitio separa el primer párrafo del resto, y con
  // un solo párrafo de relleno la tupla dejaba «el resto» con tipo never.
  presentacion: [
    '[PRESENTACIÓN DE LA ESPECIALISTA — pendiente de llenar con la trayectoria de la profesional del nuevo centro.]',
  ] as readonly string[],
} as const;

/**
 * Imágenes de relleno mientras llegan las fotos reales del centro.
 * Están marcadas "Imagen de ejemplo" a propósito. Ver la lista de pendientes.
 */
export const PLACEHOLDERS = {
  hero: '/placeholders/hero.png',
  team: '/placeholders/equipo.png',
} as const;

/**
 * Casos de antes/después que se muestran en el sitio.
 *
 * Van escritos aquí a mano y NO salen de la base de datos. Es deliberado: el
 * módulo de fotos del panel es historia clínica de pacientes en tratamiento,
 * material interno, y no puede ser la misma fuente que alimenta la portada.
 * Que publicar exija editar este archivo es el punto: nadie publica la foto de
 * un paciente por marcar sin querer una casilla.
 *
 * Las imágenes van en `public/resultados/`. Cada caso necesita la autorización
 * firmada del paciente antes de entrar en esta lista.
 *
 * Ejemplo de una entrada:
 *
 *   {
 *     id: 'densidad-frontal-01',
 *     title: 'Evolución tras seis meses de tratamiento',
 *     beforeUrl: '/resultados/caso-01-antes.jpg',
 *     afterUrl: '/resultados/caso-01-despues.jpg',
 *     sessionsCount: 8,
 *     durationLabel: '6 meses',
 *     service: { name: 'Tratamientos personalizados', slug: 'tratamientos' },
 *   }
 */
export interface CasoResultado {
  id: string;
  title: string;
  description?: string;
  beforeUrl: string;
  afterUrl: string;
  beforeAlt?: string;
  afterAlt?: string;
  sessionsCount?: number;
  durationLabel?: string;
  /** `slug` decide en qué ficha de tratamiento aparece el caso. */
  service?: { name: string; slug: string };
}

export const RESULTADOS: CasoResultado[] = [];

export const FAQS = [
  {
    question: '¿Cómo agendo una cita?',
    answer:
      'Desde esta página: elija el día y la hora entre los que están libres y deje su nombre y celular. Al terminar recibe la confirmación por WhatsApp con la dirección de la sede.',
  },
  {
    question: '¿Cuánto dura la consulta?',
    answer:
      'Una hora y cuarto. Se atiende a una persona a la vez, así que su tiempo es solo suyo y no hay sala de espera llena.',
  },
  {
    question: '¿Qué pasa si no puedo asistir?',
    answer:
      'Desde el enlace de su confirmación puede cambiar la hora o cancelar, sin llamar. Si avisa con tiempo, ese espacio se le ofrece a otra persona que lo está esperando.',
  },
  {
    question: '¿Y si se libera un horario antes del mío?',
    answer:
      'Le escribimos por WhatsApp. Si le sirve, toca el enlace y su cita se adelanta; si no, no tiene que hacer nada y su cita sigue igual. El espacio queda para el primero que lo tome.',
  },
  {
    question: '¿Qué debo llevar a la primera consulta?',
    answer:
      'Su documento de identidad, exámenes recientes si los tiene y la lista de los medicamentos que está tomando, con su dosis.',
  },
  {
    question: '¿Quién puede ver mi historia clínica?',
    answer:
      'Solo el personal autorizado del centro. Se guarda de forma privada y se trata conforme a la Ley 1581 de 2012 de protección de datos personales.',
  },
] as const;
