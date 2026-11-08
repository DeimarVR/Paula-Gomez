import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { env } from '../../config/env';
import { formatLongEs } from '../../lib/datetime';

/**
 * El PDF del consentimiento firmado, armado entero por nosotros.
 *
 * Antes la plantilla era un PDF que subía el centro y la firma se pegaba en una
 * hoja al final. Sonaba flexible y en la práctica era una fuente constante de
 * fallos: los PDF que salen de plataformas de firma vienen cifrados y `pdf-lib`
 * ni los abre; los escaneados pesan una barbaridad; los que traen fuentes
 * incrustadas raras revientan al guardarse. Y todos esos fallos aparecían en el
 * peor momento posible: con el paciente delante, ya con el documento leído y el
 * dedo en la pantalla.
 *
 * Generándolo aquí no hay ningún archivo ajeno que pueda estar mal. El texto es
 * texto en la base de datos, y de ahí sale una hoja con la misma pinta siempre.
 */

const ANCHO = 612; // Carta, en puntos.
const ALTO = 792;
const MARGEN = 56;
/** Hasta dónde puede bajar el contenido antes de saltar de página. */
const SUELO = MARGEN + 34;

const TINTA = rgb(0.08, 0.11, 0.12);
const SUAVE = rgb(0.42, 0.47, 0.48);
const LINEA = rgb(0.84, 0.86, 0.87);

/**
 * Deja el texto en caracteres que las fuentes estándar del PDF sepan escribir.
 *
 * `pdf-lib` con las fuentes estándar codifica en WinAnsi y LANZA una excepción
 * ante cualquier carácter que no quepa ahí. Los acentos y la ñ del español
 * caben; un emoji o un alfabeto distinto, no. Se descartan en vez de
 * sustituirse por un signo: un nombre con un interrogante en medio se ve peor
 * que el nombre sin esa letra, y el nombre completo queda igualmente guardado
 * en la base de datos.
 */
export function soloLatin1(texto: string): string {
  return texto
    .normalize('NFC')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    // eslint-disable-next-line no-control-regex
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

/** Parte un texto en líneas que quepan en `ancho`, midiendo con la fuente real. */
function partirEnLineas(texto: string, fuente: PDFFont, tamano: number, ancho: number): string[] {
  const palabras = soloLatin1(texto).split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return [];

  const lineas: string[] = [];
  let actual = '';

  for (const palabra of palabras) {
    const tentativa = actual ? `${actual} ${palabra}` : palabra;
    if (fuente.widthOfTextAtSize(tentativa, tamano) <= ancho) {
      actual = tentativa;
      continue;
    }
    if (actual) lineas.push(actual);

    /**
     * Una palabra sola más ancha que la caja —una URL larga, un número de
     * registro— no se puede partir por espacios. Se corta a lo bruto, que es
     * feo pero se lee; sin esto se saldría del margen y quedaría cortada por
     * el borde del papel.
     */
    if (fuente.widthOfTextAtSize(palabra, tamano) > ancho) {
      let resto = palabra;
      while (fuente.widthOfTextAtSize(resto, tamano) > ancho) {
        let corte = resto.length - 1;
        while (corte > 1 && fuente.widthOfTextAtSize(resto.slice(0, corte), tamano) > ancho) {
          corte -= 1;
        }
        lineas.push(resto.slice(0, corte));
        resto = resto.slice(corte);
      }
      actual = resto;
    } else {
      actual = palabra;
    }
  }

  if (actual) lineas.push(actual);
  return lineas;
}

/**
 * Una hoja con memoria de por dónde va escribiendo.
 *
 * Lleva la cuenta del alto ocupado y abre página nueva cuando hace falta, para
 * que el resto del módulo pueda decir «escribe este párrafo» sin pensar en
 * dónde acaba el papel.
 */
class Lienzo {
  pagina: PDFPage;
  y: number;
  readonly paginas: PDFPage[] = [];

  constructor(
    private readonly pdf: PDFDocument,
    readonly normal: PDFFont,
    readonly negrita: PDFFont,
    readonly cursiva: PDFFont,
  ) {
    this.pagina = this.abrir();
    this.y = ALTO - MARGEN;
  }

  private abrir(): PDFPage {
    const pagina = this.pdf.addPage([ANCHO, ALTO]);
    this.paginas.push(pagina);
    return pagina;
  }

  get anchoUtil(): number {
    return ANCHO - MARGEN * 2;
  }

  /** Abre página nueva si lo que viene no cabe. */
  asegurar(alto: number) {
    if (this.y - alto >= SUELO) return;
    this.pagina = this.abrir();
    this.y = ALTO - MARGEN;
  }

  espacio(alto: number) {
    this.y -= alto;
  }

  /** Un párrafo, partido en líneas y con salto de página si se acaba la hoja. */
  parrafo(
    texto: string,
    opciones: {
      tamano?: number;
      fuente?: PDFFont;
      color?: ReturnType<typeof rgb>;
      sangria?: number;
      interlineado?: number;
    } = {},
  ) {
    const tamano = opciones.tamano ?? 10.5;
    const fuente = opciones.fuente ?? this.normal;
    const color = opciones.color ?? TINTA;
    const sangria = opciones.sangria ?? 0;
    const alto = opciones.interlineado ?? tamano + 5;

    const lineas = partirEnLineas(texto, fuente, tamano, this.anchoUtil - sangria);
    for (const linea of lineas) {
      this.asegurar(alto);
      this.pagina.drawText(linea, {
        x: MARGEN + sangria,
        y: this.y - tamano,
        size: tamano,
        font: fuente,
        color,
      });
      this.y -= alto;
    }
  }

  /** Una viñeta con sangría colgante, para que la segunda línea no vuelva al margen. */
  vineta(texto: string, tamano = 10.5) {
    const alto = tamano + 5;
    this.asegurar(alto);
    this.pagina.drawText('•', {
      x: MARGEN + 4,
      y: this.y - tamano,
      size: tamano,
      font: this.normal,
      color: SUAVE,
    });
    this.parrafo(texto, { tamano, sangria: 18 });
  }

  regla(margenSuperior = 0) {
    this.espacio(margenSuperior);
    this.asegurar(12);
    this.pagina.drawLine({
      start: { x: MARGEN, y: this.y },
      end: { x: ANCHO - MARGEN, y: this.y },
      thickness: 1,
      color: LINEA,
    });
    this.espacio(12);
  }
}

export interface DatosDocumento {
  /** Nombre del consentimiento, tal como lo tituló el centro. */
  templateName: string;
  version: number;
  /** El texto del consentimiento. Párrafos separados por saltos de línea. */
  body: string;
  patientName: string;
  patientDocument: string | null;
  professionalName: string | null;
  signedAt: Date;
  /** PNG de la firma manuscrita. */
  signaturePng: Uint8Array;
  notes: string | null;
}

/**
 * El cuerpo del consentimiento, con un formato mínimo que el centro pueda usar
 * sin aprender nada.
 *
 * Solo dos convenciones, las dos naturales al escribir:
 *   - una línea entera EN MAYÚSCULAS se toma por título de sección;
 *   - una línea que empieza por «-», «*» o «•» se toma por viñeta.
 *
 * Cualquier otra cosa es un párrafo normal. No hay marcado que aprender ni
 * nada que se pueda escribir «mal»: en el peor caso sale como texto corrido,
 * que es exactamente lo que se escribió.
 */
function escribirCuerpo(hoja: Lienzo, cuerpo: string) {
  /**
   * Se parte por líneas ANTES de limpiar caracteres, no después.
   *
   * `soloLatin1` se come el salto de línea —es un carácter de control y cae
   * dentro de lo que descarta—, así que limpiar primero dejaba el documento
   * entero convertido en un párrafo corrido, sin títulos ni viñetas. La
   * limpieza la hace después cada línea al medirse.
   */
  const bloques = cuerpo.replace(/\r\n?/g, '\n').split('\n');

  for (const crudo of bloques) {
    const linea = crudo.trim();

    if (!linea) {
      hoja.espacio(7);
      continue;
    }

    if (/^[-*•]\s+/.test(linea)) {
      hoja.vineta(linea.replace(/^[-*•]\s+/, ''));
      continue;
    }

    const letras = linea.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
    const esTitulo = letras.length >= 3 && letras === letras.toUpperCase() && linea.length <= 90;

    if (esTitulo) {
      hoja.espacio(8);
      hoja.asegurar(30);
      hoja.parrafo(linea, { tamano: 10.5, fuente: hoja.negrita });
      hoja.espacio(2);
      continue;
    }

    hoja.parrafo(linea);
    hoja.espacio(3);
  }
}

/** El texto fijo que va encima de la firma, y que no depende de la plantilla. */
const DECLARACION =
  'Declaro que leí este documento, que se me explicó el procedimiento con sus alcances, ' +
  'riesgos y alternativas, que pude preguntar todo lo que necesitaba y que acepto realizarlo.';

/** El bloque de firma. Se mantiene entero: no se parte entre dos hojas. */
async function escribirFirma(pdf: PDFDocument, hoja: Lienzo, datos: DatosDocumento) {
  const firma = await pdf.embedPng(datos.signaturePng);
  const anchoFirma = 210;
  const altoFirma = Math.min((firma.height / firma.width) * anchoFirma, 90);

  /**
   * Todo el bloque va de una pieza: declaración, firma, raya, nombre, cédula,
   * fecha, profesional y observaciones.
   *
   * El alto se calcula, no se estima. Con una reserva a ojo el bloque cabía
   * «casi» entero y las dos últimas líneas caían solas en una hoja nueva: una
   * página con «Atendido por» y nada más, que en un documento que se firma
   * parece un anexo perdido. Cada sumando de aquí abajo es una de las llamadas
   * que vienen después, en el mismo orden.
   */
  const lineas = (texto: string, tamano: number) =>
    partirEnLineas(texto, hoja.normal, tamano, hoja.anchoUtil).length * (tamano + 5);

  let necesario =
    24 + // espacio antes de la declaración
    lineas(DECLARACION, 10) +
    30 + // espacio hasta la firma
    altoFirma +
    6 + // aire bajo la firma
    14 + // hasta la raya
    15.5 + // nombre
    14 + // «Firma del paciente»
    12 + // espacio
    14.5; // fecha
  if (datos.patientDocument) necesario += 14.5;
  if (datos.professionalName) necesario += 14.5;
  if (datos.notes) necesario += 4 + lineas(`Observaciones: ${datos.notes}`, 9.5);

  hoja.asegurar(necesario);

  hoja.espacio(24);
  hoja.parrafo(DECLARACION, { tamano: 10, color: SUAVE });

  hoja.espacio(30);
  hoja.pagina.drawImage(firma, {
    x: MARGEN,
    y: hoja.y - altoFirma,
    width: anchoFirma,
    height: altoFirma,
  });
  hoja.espacio(altoFirma + 6);

  hoja.pagina.drawLine({
    start: { x: MARGEN, y: hoja.y },
    end: { x: MARGEN + anchoFirma + 60, y: hoja.y },
    thickness: 1,
    color: rgb(0.6, 0.64, 0.65),
  });
  hoja.espacio(14);

  hoja.parrafo(datos.patientName, { tamano: 10.5, fuente: hoja.negrita });
  if (datos.patientDocument) {
    hoja.parrafo(`C.C. ${datos.patientDocument}`, { tamano: 9.5, color: SUAVE });
  }
  hoja.parrafo('Firma del paciente', { tamano: 9, color: SUAVE });

  hoja.espacio(12);
  hoja.parrafo(`Firmado el ${formatLongEs(datos.signedAt, env.CLINIC_TIMEZONE)}`, {
    tamano: 9.5,
    color: SUAVE,
  });
  if (datos.professionalName) {
    hoja.parrafo(`Atendido por ${datos.professionalName}`, { tamano: 9.5, color: SUAVE });
  }
  if (datos.notes) {
    hoja.espacio(4);
    hoja.parrafo(`Observaciones: ${datos.notes}`, {
      tamano: 9.5,
      fuente: hoja.cursiva,
      color: SUAVE,
    });
  }
}

/**
 * Pie con la numeración, escrito al final.
 *
 * Tiene que ser al final porque «página 2 de 5» necesita saber cuántas hojas
 * salieron, y eso no se sabe hasta haber escrito la última.
 */
function escribirPie(hoja: Lienzo, titulo: string) {
  const total = hoja.paginas.length;

  hoja.paginas.forEach((pagina, indice) => {
    pagina.drawLine({
      start: { x: MARGEN, y: MARGEN - 6 },
      end: { x: ANCHO - MARGEN, y: MARGEN - 6 },
      thickness: 0.5,
      color: LINEA,
    });

    const izquierda = soloLatin1(`${env.CLINIC_NAME} · ${titulo}`);
    pagina.drawText(izquierda, {
      x: MARGEN,
      y: MARGEN - 20,
      size: 8,
      font: hoja.normal,
      color: SUAVE,
    });

    const derecha = `Pagina ${indice + 1} de ${total}`;
    pagina.drawText(derecha, {
      x: ANCHO - MARGEN - hoja.normal.widthOfTextAtSize(derecha, 8),
      y: MARGEN - 20,
      size: 8,
      font: hoja.normal,
      color: SUAVE,
    });
  });
}

/** Arma el PDF completo del consentimiento firmado. */
export async function armarPdf(datos: DatosDocumento): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cursiva = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const hoja = new Lienzo(pdf, normal, negrita, cursiva);

  // --- Encabezado ---------------------------------------------------------
  hoja.parrafo(env.CLINIC_NAME, { tamano: 15, fuente: negrita });
  hoja.parrafo(env.CLINIC_ADDRESS, { tamano: 9, color: SUAVE });
  hoja.regla(10);

  hoja.parrafo(datos.templateName.toUpperCase(), { tamano: 12.5, fuente: negrita });
  hoja.espacio(6);

  // --- Datos del paciente -------------------------------------------------
  hoja.parrafo(`Paciente: ${datos.patientName}`, { tamano: 10.5 });
  if (datos.patientDocument) {
    hoja.parrafo(`Documento de identidad: ${datos.patientDocument}`, { tamano: 10.5 });
  }
  hoja.parrafo(`Fecha: ${formatLongEs(datos.signedAt, env.CLINIC_TIMEZONE)}`, { tamano: 10.5 });
  hoja.parrafo(`Versión del documento: ${datos.version}`, { tamano: 9.5, color: SUAVE });

  hoja.regla(12);

  // --- El consentimiento --------------------------------------------------
  escribirCuerpo(hoja, datos.body);

  // --- Firma --------------------------------------------------------------
  await escribirFirma(pdf, hoja, datos);

  escribirPie(hoja, datos.templateName);

  pdf.setTitle(soloLatin1(`${datos.templateName} - ${datos.patientName}`));
  pdf.setProducer(env.CLINIC_NAME);
  pdf.setCreationDate(datos.signedAt);

  return pdf.save();
}
