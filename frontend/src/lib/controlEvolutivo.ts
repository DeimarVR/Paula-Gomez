/**
 * Todo lo de la ficha de control evolutivo, en un solo archivo.
 *
 * Los rótulos, las zonas y las columnas
 * viven aquí para que corregir un texto sea tocar un sitio y no ocho.
 *
 * ⚠️ REVISAR CONTRA LA FICHA DE PAPEL antes de usarla en serie.
 */

/**
 * Cómo se llama el módulo en el panel.
 *
 * Separado del título de la tabla a propósito: el apartado del panel se llama
 * como lo llama el centro, y el cuadro impreso conserva el rótulo que trae la
 * hoja de papel. Son dos nombres distintos para dos cosas distintas.
 */
export const TITULO_MODULO = 'Control de pacientes';

/** El rótulo tal como está impreso en el talonario. */
export const TITULO_TABLA = 'Control evolutivo por sesiones';

export type TipoAtencion = 'TERAPIAS_CAPILARES' | 'TRASPLANTE';

export const TIPOS_ATENCION: Array<{ id: TipoAtencion; etiqueta: string }> = [
  { id: 'TERAPIAS_CAPILARES', etiqueta: 'Terapias capilares' },
  { id: 'TRASPLANTE', etiqueta: 'Trasplante' },
];

/**
 * Cómo viaja el tipo de ficha en la dirección de «ficha nueva».
 *
 * Va corto y en minúscula porque queda a la vista del usuario en la barra del
 * navegador, pero lo que se guarda sigue siendo el valor del enum: esta tabla
 * es la única traducción entre los dos, para que nadie escriba «trasplante»
 * suelto en un enlace y descubra al guardar que el tipo no era ese.
 */
export const TIPO_EN_ENLACE: Record<TipoAtencion, string> = {
  TERAPIAS_CAPILARES: 'capilar',
  TRASPLANTE: 'trasplante',
};

/** Lo contrario: de lo que viene en la dirección al valor que se guarda. */
export function tipoDesdeEnlace(valor: string | null | undefined): TipoAtencion {
  const encontrado = (Object.entries(TIPO_EN_ENLACE) as Array<[TipoAtencion, string]>).find(
    ([, enlace]) => enlace === valor,
  );
  // Sin parámetro —o con uno que no se reconoce— se abre la ficha de siempre.
  return encontrado ? encontrado[0] : 'TERAPIAS_CAPILARES';
}

/**
 * Zonas del cuero cabelludo que se marcan en los diagramas.
 *
 * Los identificadores NO se cambian nunca: quedan guardados en las fichas ya
 * creadas y renombrarlos dejaría marcas huérfanas. Lo que sí se puede cambiar
 * libremente es la etiqueta.
 */
export const ZONAS = [
  { id: 'entradas', etiqueta: 'Entradas' },
  { id: 'frontal', etiqueta: 'Frontal' },
  { id: 'media', etiqueta: 'Zona media' },
  { id: 'vertex', etiqueta: 'Vértex / corona' },
  { id: 'temporal-izq', etiqueta: 'Temporal izquierdo' },
  { id: 'temporal-der', etiqueta: 'Temporal derecho' },
  { id: 'occipital', etiqueta: 'Occipital / nuca' },
] as const;

export type ZonaId = (typeof ZONAS)[number]['id'];

export function etiquetaZona(id: string): string {
  return ZONAS.find((zona) => zona.id === id)?.etiqueta ?? id;
}

/**
 * Todo el cuero cabelludo, como opción de «Zona tratada».
 *
 * NO es una zona de los diagramas y por eso no está en `ZONAS`. Las cabezas
 * marcan lo AFECTADO —el diagnóstico de la ficha—; esta columna dice qué se
 * trató en la sesión, que no es lo mismo. En una mesoterapia de cuero completo
 * se pincha todo aunque la alopecia solo esté en la corona, y obligar a marcar
 * las siete zonas una por una para escribir eso es trabajo de más.
 *
 * Va primero en las sugerencias porque es el caso más frecuente.
 */
export const ZONA_COMPLETA = 'Completa';

/** Lo que se ofrece al escribir en «Zona tratada». */
export const SUGERENCIAS_ZONA: string[] = [ZONA_COMPLETA, ...ZONAS.map((zona) => zona.etiqueta)];

/** Las cuatro zonas capilares numeradas del recuadro de trasplante. */
export const ZONAS_TRASPLANTE = [1, 2, 3, 4] as const;

/**
 * Las columnas de la tabla, en el orden del papel.
 *
 * `clave` es el campo del modelo; `ancho` es la proporción que ocupa al
 * imprimir. Tenerlas aquí evita que la cabecera de la tabla y las celdas se
 * desincronicen al agregar o mover una columna.
 */
export const COLUMNAS = [
  { clave: 'sessionDate', titulo: 'Fecha', ancho: 'w-[8%]' },
  { clave: 'controlLabel', titulo: 'Control', ancho: 'w-[6%]' },
  { clave: 'alopeciaType', titulo: 'Tipo de alopecia', ancho: 'w-[9%]' },
  {
    clave: 'treatment',
    titulo: 'Tratamiento',
    detalle: '(Meso / PRP / Exosomas / Dutasteride / Lavados)',
    ancho: 'w-[13%]',
  },
  { clave: 'treatedZone', titulo: 'Zona tratada', ancho: 'w-[8%]' },
  { clave: 'oralMedication', titulo: 'Medicación oral', ancho: 'w-[9%]' },
  { clave: 'topicalMedication', titulo: 'Medicación tópica', ancho: 'w-[9%]' },
  { clave: 'shampoo', titulo: 'Shampoo', ancho: 'w-[9%]' },
  { clave: 'findings', titulo: 'Hallazgos clínicos', ancho: 'w-[11%]' },
  {
    clave: 'nextControl',
    titulo: 'Próximo control',
    ancho: 'w-[8%]',
    /** Al llenar, esta celda lleva además hora y tratamiento para agendar. */
    anchoEditable: 'w-[13%]',
  },
] as const;

/**
 * Los campos del bloque "Datos del paciente", en orden.
 *
 * De aquí salen LAS DOS disposiciones: la hoja ancha —donde `fila` y `ancho`
 * deciden cómo se reparten— y la columna apilada del celular, que los recorre
 * en el mismo orden a ancho completo. Tener una sola lista es lo que impide
 * que agregar un campo se quede a medias en una de las dos.
 *
 * Las entradas con `bloque` no son campos sueltos: son los grupos de casillas
 * del papel, que se dibujan aparte. Están en la lista para que conserven su
 * posición dentro de la fila.
 *
 * `ancho` mide EL ESPACIO DE ESCRITURA, no el conjunto rótulo + espacio. Es una
 * distinción que costó cara: mientras midió el conjunto, la píldora «TELÉFONO»
 * —que no encoge— se comía los 84 px enteros y el input se quedaba en cero,
 * así que Edad, Teléfono, # folículos y Perdidos se veían pero no dejaban
 * escribir. Un `flex-1` en `ancho` significa «reparte lo que sobre en la fila».
 */
export type CampoCabecera =
  | {
      clave: 'patientName' | 'patientDocument' | 'patientPhone' | 'warranty';
      etiqueta: string;
      tipo: 'texto';
      fila: number;
      ancho: string;
      numerico?: boolean;
    }
  | {
      clave: 'patientAge' | 'totalSessions' | 'follicles' | 'folliclesLost';
      etiqueta: string;
      tipo: 'numero';
      fila: number;
      ancho: string;
    }
  | { clave: 'procedureDate'; etiqueta: string; tipo: 'fecha'; fila: number; ancho: string }
  | { bloque: 'tipoPaciente' | 'trasplante'; fila: number };

export const CAMPOS_CABECERA: readonly CampoCabecera[] = [
  // Fila 1: el nombre se queda con lo que sobre, pero la cédula tiene su sitio
  // reservado. Antes el nombre lo empujaba y un documento de diez dígitos salía
  // cortado.
  { clave: 'patientName', etiqueta: 'Nombre', tipo: 'texto', fila: 1, ancho: 'min-w-0 flex-1' },
  { clave: 'patientDocument', etiqueta: 'Documento', tipo: 'texto', fila: 1, ancho: 'w-[104px]', numerico: true },
  { clave: 'procedureDate', etiqueta: 'Fecha', tipo: 'fecha', fila: 1, ancho: 'shrink-0' },

  // Fila 2: los tres campos son cortos y llevan medida fija; lo que sobra se lo
  // queda el bloque de casillas, que es lo único que crece bien.
  { clave: 'patientAge', etiqueta: 'Edad', tipo: 'numero', fila: 2, ancho: 'w-[40px]' },
  { clave: 'patientPhone', etiqueta: 'Teléfono', tipo: 'texto', fila: 2, ancho: 'w-[104px]', numerico: true },
  { clave: 'totalSessions', etiqueta: 'Total sesiones', tipo: 'numero', fila: 2, ancho: 'w-[44px]' },
  { bloque: 'tipoPaciente', fila: 2 },

  { bloque: 'trasplante', fila: 3 },
  { clave: 'follicles', etiqueta: '# folículos', tipo: 'numero', fila: 3, ancho: 'w-[56px]' },
  { clave: 'folliclesLost', etiqueta: 'Perdidos', tipo: 'numero', fila: 3, ancho: 'w-[56px]' },

  { clave: 'warranty', etiqueta: 'Garantía', tipo: 'texto', fila: 4, ancho: 'min-w-0 flex-1' },
] as const;

/** Las filas de la cabecera, en orden. */
export const FILAS_CABECERA = [1, 2, 3, 4] as const;

/**
 * Ancho de la hoja editable, en píxeles.
 *
 * Es el `min-w-[1180px]` del componente. Vive aquí porque también se usa para
 * calcular cuánto hay que encogerla para que quepa; si cambia uno sin el otro,
 * la hoja se corta o sobra espacio.
 */
export const ANCHO_HOJA_EDITABLE = 1180;

/**
 * Ancho por debajo del cual la hoja deja de caber y se apila.
 *
 * Se mide el CONTENEDOR, no la ventana: en el panel la barra lateral se come
 * 256 px, así que una ventana de 1366 deja menos de 1000 para la hoja.
 */
export const ANCHO_MINIMO_HOJA = 1100;

/**
 * Hasta dónde se puede encoger la hoja antes de que la letra deje de leerse.
 *
 * Es el suelo de la escala, y de él sale también el ancho por debajo del cual
 * apilar deja de ser una preferencia y pasa a ser obligatorio: si ni siquiera
 * al 80 % cabe, seguir dibujando la hoja solo produce un documento cortado.
 */
export const ESCALA_MINIMA_HOJA = 0.8;

/**
 * Por debajo de esto la hoja NO cabe ni encogida del todo: 1180 × 0,8 = 944.
 *
 * Es un límite duro y deliberadamente independiente de si la pantalla es
 * táctil. Antes apilar dependía de `pointer: coarse`, y eso dejaba fuera dos
 * casos reales: un teléfono visto desde el modo responsive del navegador —que
 * no emula el dedo salvo que se le pida— y una tablet con teclado y ratón. En
 * los dos salía la hoja de 1180 px recortada dentro de una pantalla de 390.
 */
export const ANCHO_MINIMO_SIN_APILAR = Math.round(ANCHO_HOJA_EDITABLE * ESCALA_MINIMA_HOJA);


/**
 * Sufijo de la columna «Control»: 1H, 2H, 3H…
 *
 * Copiado del talonario. Si alguna vez deja de usarse, se cambia aquí y ya.
 */
export const SUFIJO_CONTROL = 'H';

/** La etiqueta que le toca a la sesión número `n`. */
export function etiquetaControl(n: number): string {
  return `${n}${SUFIJO_CONTROL}`;
}

/** Filas mínimas del cuadro, en blanco si no hay tantas sesiones. */
export const FILAS_MINIMAS = 8;

export interface LineaControl {
  id?: string | null;
  sessionDate: string;
  controlLabel: string | null;
  alopeciaType: string | null;
  treatment: string | null;
  treatedZone: string | null;
  oralMedication: string | null;
  topicalMedication: string | null;
  shampoo: string | null;
  findings: string | null;
  nextControl: string | null;
  /** "HH:mm". Junto con la fecha y el tratamiento, agenda la cita. */
  nextControlTime: string | null;
  nextControlServiceId: string | null;
  professionalSignature?: string | null;
  patientSignature?: string | null;
  sortOrder?: number;
  /** Cita ya creada, si la hay. Solo lectura: la crea el servidor. */
  nextControlAppointment?: {
    id: string;
    startsAt: string;
    status: string;
    googleHtmlLink: string | null;
  } | null;
}

/**
 * Los datos que pinta la hoja, sin los campos de la base.
 *
 * Existe para que la MISMA hoja sirva de formulario y de vista de impresión.
 * Antes eran dos maquetados distintos —tarjetas para llenar, tabla para
 * imprimir— y eso significa que cualquier cambio hay que hacerlo dos veces y
 * que tarde o temprano dejan de parecerse.
 */
export interface DatosHoja {
  procedureDate: string;
  patientName: string;
  patientDocument: string | null;
  patientAge: number | null;
  patientPhone: string | null;
  careType: TipoAtencion;
  totalSessions: number | null;
  transplantBeard: boolean;
  transplantEyebrows: boolean;
  transplantScalp: boolean;
  transplantZones: number[];
  follicles: number | null;
  folliclesLost: number | null;
  warranty: string | null;
  markedZones: string[];
  notes: string | null;
  entries: LineaControl[];
}

/** Lo que devuelve el servidor cuando algo de la agenda no salió. */
export interface AvisoAgenda {
  sesion: number;
  mensaje: string;
}

export interface Ficha {
  id: string;
  patientId: string;
  procedureDate: string;
  patientName: string;
  patientDocument: string | null;
  patientAge: number | null;
  patientPhone: string | null;
  careType: TipoAtencion;
  totalSessions: number | null;
  transplantBeard: boolean;
  transplantEyebrows: boolean;
  transplantScalp: boolean;
  transplantZones: number[];
  follicles: number | null;
  folliclesLost: number | null;
  warranty: string | null;
  markedZones: string[];
  notes: string | null;
  entries: Array<LineaControl & { id: string; sortOrder: number }>;
  avisos?: AvisoAgenda[];
  createdAt: string;
  patient?: { id: string; fullName: string } | null;
  createdBy?: { id: string; fullName: string } | null;
}

/**
 * Edad cumplida a partir de la fecha de nacimiento.
 *
 * Se resta un año si todavía no ha llegado el cumpleaños de este año; hacer
 * solo la diferencia de años daría un año de más durante media vida del
 * paciente.
 */
export function edadCumplida(nacimiento: string | Date | null | undefined): number | null {
  if (!nacimiento) return null;
  const fecha = new Date(nacimiento);
  if (Number.isNaN(fecha.getTime())) return null;

  const hoy = new Date();
  let edad = hoy.getFullYear() - fecha.getFullYear();
  const mes = hoy.getMonth() - fecha.getMonth();
  if (mes < 0 || (mes === 0 && hoy.getDate() < fecha.getDate())) edad -= 1;

  return edad >= 0 && edad < 130 ? edad : null;
}
