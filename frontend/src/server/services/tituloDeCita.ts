/**
 * Lee lo que se escribió en el título de un evento de Google Calendar.
 *
 * El formato acordado con el centro:
 *
 *     Cita: María Fernanda Rosero - 3001112233 - mesoterapia
 *
 * y la cédula, si la tienen a mano, en la descripción del evento.
 *
 * Esto existe porque en el mostrador la señal se cae. La app de Calendar del
 * celular guarda el evento sin internet y lo sube sola cuando vuelve; el
 * sistema lo recoge después. O sea que este texto lo escribe una persona
 * apurada, con el paciente al teléfono, en el teclado de un celular. Por eso el
 * lector es deliberadamente tolerante: acepta guiones de varias clases, espacios
 * de más, mayúsculas o minúsculas, el teléfono con puntos o espacios, y las
 * partes en cualquier orden razonable.
 *
 * Lo que NO hace es adivinar. Si algo no se entiende, lo deja en `null` y quien
 * llama decide qué hacer —importar la cita marcada como incompleta es mucho
 * mejor que inventarle un teléfono a un paciente—.
 */

/** Solo se importan los eventos que empiezan así. Todo lo demás del calendario se ignora. */
export const MARCA = 'cita:';

/**
 * La marca del principio, escrita de las formas en que sale de verdad.
 *
 * «Cita:», «cita -», «CITA» a secas. El `\b` es lo que evita que un evento
 * llamado «Citas de la semana» se cuele: después de «cita» tiene que venir algo
 * que no sea letra.
 */
const MARCA_AL_INICIO = /^cita\b\s*[:;.\-–—|]?\s*/i;

export interface CitaLeida {
  nombre: string;
  /** Diez dígitos, sin indicativo. `null` si no venía o no se entendió. */
  telefono: string | null;
  /** Lo que se escribió como tratamiento, para buscarlo en el catálogo. */
  tratamiento: string | null;
  /** De la descripción del evento. */
  documento: string | null;
  /** Lo que no se pudo interpretar, para poder decírselo a quien revise. */
  avisos: string[];
}

/**
 * Dónde se corta el título.
 *
 * El acuerdo era escribir « - » con espacios a los lados, pero en el celular
 * eso no pasa: sale «lilet lopez-3023883744-mesoterapia», todo pegado, y el
 * título entero terminaba guardado como si fuera el nombre del paciente.
 *
 * Así que el guion corta aunque no traiga espacios. Con una salvedad: pegado
 * entre dos letras NO corta, porque ahí casi siempre es parte de un nombre
 * («Ana-María», «Rodríguez-Bolaños») o de un tratamiento («post-operatorio»).
 * Y pegado entre dos números tampoco, que es como se escribe un celular
 * partido: «302-388-3744». Solo corta donde una letra se topa con un número,
 * que es justo donde termina el nombre y empieza el teléfono.
 */
const GUION = '[-–—|]';

const SEPARADORES: RegExp[] = [
  // Un guion con aire a algún lado: « - », «- », « -».
  new RegExp(`\\s+${GUION}\\s*|\\s*${GUION}\\s+`, 'g'),
  // Pegado, pero en la frontera entre letras y números.
  new RegExp(`(?<=\\d)${GUION}(?=\\D)|(?<=\\D)${GUION}(?=\\d)`, 'g'),
  // La coma, que es como mucha gente escribe una lista.
  /\s*,\s*/g,
  // Salto de línea: en la app del celular se escribe el título en varios renglones.
  /\s*[\r\n]+\s*/g,
  /**
   * La barra, pero solo con espacios. Sin ellos no: «prp/exosomas» es un
   * tratamiento, no dos campos.
   */
  /\s+\/\s+/g,
];

/**
 * Un celular dentro de un texto más largo, aunque venga pegado a lo demás.
 *
 * Sirve para «Cita: lilet lopez 3023883744 mesoterapia», sin un solo guion:
 * lo de antes es el nombre y lo de después, el tratamiento.
 */
const TELEFONO_ADENTRO = /(?:\+?57[\s.-]*)?3[\d.\s-]{8,}\d/;

/**
 * Corta el título en sus partes, con todos los separadores que se aceptan.
 *
 * Cada separador se cambia primero por una marca que nadie puede haber escrito
 * y al final se parte por ahí. Partir de nuevo por cada separador, uno tras
 * otro, obligaría a llevar listas de listas para no ganar nada.
 */
const CORTE = '\u0000';

function partirEnPartes(cuerpo: string): string[] {
  let texto = cuerpo;
  for (const separador of SEPARADORES) texto = texto.replace(separador, CORTE);
  return texto.split(CORTE).map((parte) => parte.trim()).filter(Boolean);
}

/**
 * Un celular colombiano: diez dígitos que empiezan por 3. Se acepta escrito con
 * espacios, puntos o guiones, y con el +57 adelante.
 */
function extraerTelefono(texto: string): string | null {
  const digitos = texto.replace(/\D/g, '');
  if (!digitos) return null;

  const sinIndicativo =
    digitos.startsWith('57') && digitos.length === 12 ? digitos.slice(2) : digitos;

  return /^3\d{9}$/.test(sinIndicativo) ? sinIndicativo : null;
}

/** Una cédula colombiana: entre 6 y 11 dígitos, y no puede ser el celular. */
function extraerDocumento(descripcion: string | null): string | null {
  if (!descripcion) return null;

  // Primero se busca etiquetada, que es lo más fiable: «cc 1085…», «CC: 1085…».
  const etiquetada = descripcion.match(/\b(?:c\.?c\.?|cedula|cédula|documento)\s*:?\s*([\d.\s]{6,16})/i);
  if (etiquetada) {
    const d = etiquetada[1].replace(/\D/g, '');
    if (d.length >= 6 && d.length <= 11) return d;
  }

  // Si no, cualquier número suelto que no parezca un celular.
  for (const suelto of descripcion.match(/[\d.]{6,16}/g) ?? []) {
    const d = suelto.replace(/\D/g, '');
    if (d.length >= 6 && d.length <= 11 && !/^3\d{9}$/.test(d)) return d;
  }
  return null;
}

/** ¿Este evento es una cita, o es la reunión con el proveedor? */
export function esEventoDeCita(titulo: string): boolean {
  return MARCA_AL_INICIO.test(titulo.trim());
}

export function leerTituloDeCita(titulo: string, descripcion: string | null = null): CitaLeida | null {
  if (!esEventoDeCita(titulo)) return null;

  const avisos: string[] = [];
  const cuerpo = titulo.trim().replace(MARCA_AL_INICIO, '').trim();
  if (!cuerpo) return null;

  /**
   * Cada parte se clasifica por lo que es, no por dónde está: si alguien
   * escribió el tratamiento antes que el teléfono, igual se entiende. Lo que
   * parece un celular es el celular; lo demás, nombre y tratamiento, en el
   * orden en que quedaron.
   *
   * El celular se busca DENTRO de cada parte, no solo cuando viene solito.
   * «lilet lopez 3023883744 mesoterapia», sin un guion en todo el título, se
   * parte en tres por el propio teléfono.
   */
  let telefono: string | null = null;
  const trozos: string[] = [];

  for (const parte of partirEnPartes(cuerpo)) {
    if (telefono) {
      trozos.push(parte);
      continue;
    }

    const encontrado = parte.match(TELEFONO_ADENTRO);
    const posible = encontrado ? extraerTelefono(encontrado[0]) : null;
    if (!encontrado || posible === null || encontrado.index === undefined) {
      trozos.push(parte);
      continue;
    }

    telefono = posible;
    const antes = parte.slice(0, encontrado.index).trim();
    const despues = parte.slice(encontrado.index + encontrado[0].length).trim();
    if (antes) trozos.push(antes);
    if (despues) trozos.push(despues);
  }

  // El nombre es lo primero que quedó que no era el teléfono.
  const nombre = trozos[0] ?? '';
  const sobrantes = trozos.slice(1);

  if (!nombre || nombre.replace(/[^a-zA-ZÁÉÍÓÚÑáéíóúñ]/g, '').length < 2) {
    return null;
  }
  if (!telefono) avisos.push('El título no trae un celular que se entienda');
  if (sobrantes.length === 0) avisos.push('El título no dice el tratamiento');

  return {
    nombre: nombre.replace(/\s+/g, ' '),
    telefono,
    tratamiento: sobrantes.length ? sobrantes.join(' ') : null,
    documento: extraerDocumento(descripcion),
    avisos,
  };
}
