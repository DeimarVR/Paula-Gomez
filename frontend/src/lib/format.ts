/** Formateo consistente en toda la web, en español de Colombia. */

// `||`: una variable vacía daría '' e `Intl` lanza RangeError con eso.
const CLINIC_TIMEZONE = process.env.NEXT_PUBLIC_CLINIC_TIMEZONE || 'America/Bogota';

export function formatCop(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Consultar';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateLong(input: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: CLINIC_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(input));
}

export function formatDateShort(input: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: CLINIC_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(input));
}

/** «9 nov · 10:30 am». La hora con el mismo formato que en todo el sitio. */
export function formatDateTime(input: string | Date): string {
  const dia = new Intl.DateTimeFormat('es-CO', { timeZone: CLINIC_TIMEZONE, day: 'numeric', month: 'short' })
    .format(new Date(input))
    .replace('.', '');
  return `${dia} · ${horaCorta(input)}`;
}

export function formatTime(input: string | Date): string {
  return horaCorta(input);
}

/** "hace 3 días", "en 2 semanas". */
export function formatRelative(input: string | Date): string {
  const diffMs = new Date(input).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto' });

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000_000],
    ['month', 2_592_000_000],
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];

  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) return rtf.format(Math.round(diffMs / ms), unit);
  }
  return 'ahora mismo';
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/**
 * Un teléfono legible. Aguanta que no llegue nada.
 *
 * El parámetro es `string` en los tipos, pero en tiempo de ejecución puede
 * llegar `undefined`: basta con que una respuesta de la API cambie de forma
 * —un campo que se renombra, una promesa que alguien olvidó esperar— para que
 * el valor no exista. Sin esta guarda, eso no daba un dato vacío: reventaba la
 * página entera con una pantalla roja, y el fallo aparecía en un sitio que no
 * tenía nada que ver con la causa.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';

  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '—';
  if (digits.startsWith('57') && digits.length === 12) {
    const local = digits.slice(2);
    return `+57 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return `+${digits}`;
}

/** Los días de la semana empiezan en domingo, igual que `Date.getDay()`. */
export const WEEKDAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const;

/** "2026-03-14" → "vie 14 mar" (sin depender de la zona del navegador). */
export function formatDateKey(dateKey: string): { weekday: string; day: string; month: string } {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return {
    weekday: WEEKDAYS_SHORT[date.getUTCDay()],
    day: String(day).padStart(2, '0'),
    month: new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' }).format(date),
  };
}

export function buildWhatsAppLink(phone: string, message?: string): string {
  const base = `https://wa.me/${conIndicativo(phone)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Le pone el 57 al número si le falta.
 *
 * wa.me NO acepta un número sin indicativo de país: `wa.me/3176366450` abre
 * WhatsApp y dice que el número no existe. Los pacientes se guardan ya
 * normalizados, pero el teléfono de una FACTURA se escribe a mano en el
 * mostrador y ahí casi nadie escribe el 57 — así que todos los recordatorios de
 * cobro salían con un enlace roto.
 *
 * Se arregla al construir el enlace y no al guardar porque también hay que
 * arreglar los documentos que YA están guardados sin indicativo.
 */
function conIndicativo(telefono: string): string {
  const digitos = telefono.replace(/\D/g, '');
  // 10 dígitos son un número colombiano sin indicativo: celular (empieza por 3)
  // o fijo con indicativo de área.
  if (digitos.length === 10) return `57${digitos}`;
  return digitos;
}

/** Recorta un texto sin partir palabras. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

/* ---------------------------------------------------------------------
 * Fechas sin hora (documentos: facturas, fichas clínicas)
 * ------------------------------------------------------------------ */

/**
 * La fecha de emisión se guarda a medianoche UTC y se lee en UTC.
 *
 * Formatearla con la zona del navegador la correría un día hacia atrás para
 * cualquiera en Colombia (UTC-5), que es exactamente el error que hace que una
 * factura del 30 aparezca como del 29.
 */
export function claveFecha(valor: string | Date): string {
  return new Date(valor).toISOString().slice(0, 10);
}

/** Hoy, en la zona de la clínica, como "yyyy-mm-dd". */
export function hoyEnClinica(): string {
  const zona = process.env.NEXT_PUBLIC_CLINIC_TIMEZONE || 'America/Bogota';
  // `en-CA` da directamente el formato ISO corto, sin tener que recomponerlo.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** "29 de agosto de 2026", partido en día / mes / año para las casillas. */
export function partesFecha(clave: string): { dia: string; mes: string; anio: string } {
  const [anio, mes, dia] = clave.split('-');
  return { dia, mes, anio };
}

export const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

export function fechaLarga(clave: string): string {
  const { dia, mes, anio } = partesFecha(clave);
  return `${Number(dia)} de ${NOMBRES_MES[Number(mes) - 1]} de ${anio}`;
}

/**
 * Devuelve los 10 dígitos locales del teléfono.
 *
 * En la base los teléfonos se guardan en formato internacional
 * ("573001234567") porque así los necesita WhatsApp. En una factura colombiana
 * eso sobra: nadie escribe el indicativo del país en el talonario. Se recorta
 * el 57 solo cuando el número tiene la longitud esperada, para no mutilar un
 * número extranjero o mal digitado.
 */
export function telefonoLocal(telefono: string | null | undefined): string {
  if (!telefono) return '';
  const digitos = telefono.replace(/\D/g, '');
  if (digitos.startsWith('57') && digitos.length === 12) return digitos.slice(2);
  return digitos;
}

/** «María Fernanda Ortiz» → «MO». Las iniciales sirven de retrato. */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  const primera = partes[0][0] ?? '';
  // La última palabra suele ser el apellido: «María Fernanda Ortiz» → «MO».
  const ultima = partes.length > 1 ? (partes[partes.length - 1][0] ?? '') : '';
  return `${primera}${ultima}`.toUpperCase();
}

/** «Buenos días» / «Buenas tardes» / «Buenas noches», en la hora del centro. */
export function saludoSegunHora(ahora: Date = new Date()): string {
  const hora = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: CLINIC_TIMEZONE, hour: 'numeric', hour12: false })
      .format(ahora)
      .replace(/\D/g, ''),
  ) % 24;
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/**
 * «8:00 am», «2:15 pm»: la hora como se dice en el centro.
 *
 * `Intl` en es-CO escribe «8:00 a. m.», con puntos y espacios que en una
 * columna de agenda estorban. Sale de la zona del centro, nunca de la del
 * navegador.
 */
export function horaCorta(input: string | Date): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(input));
  const dato = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return `${dato('hour')}:${dato('minute')} ${dato('dayPeriod').toLowerCase()}`;
}

/** «viernes 16 de octubre», sin año: para encabezados de día. */
export function diaEnPalabras(input: string | Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: CLINIC_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(input));
}

/**
 * Lo mismo que `diaEnPalabras`, para una clave «2026-11-17».
 *
 * `new Date('2026-11-17')` es la medianoche UTC, que en Colombia todavía es
 * el día 16 a las 7 de la noche. Se toma el mediodía UTC para que la fecha no
 * se corra en ninguna zona de América.
 */
export function diaDeClave(clave: string): string {
  return diaEnPalabras(`${clave}T12:00:00Z`);
}

/** «11 nov · 8:00 am»: fecha corta y hora, para listas del panel. */
export function fechaHoraCorta(input: string | Date): string {
  const dia = new Intl.DateTimeFormat('es-CO', { timeZone: CLINIC_TIMEZONE, day: 'numeric', month: 'short' })
    .format(new Date(input))
    .replace('.', '');
  return `${dia} · ${horaCorta(input)}`;
}
