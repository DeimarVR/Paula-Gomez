/**
 * Utilidades de fecha/hora con zona horaria, sin dependencias externas.
 *
 * Todo lo que se guarda en base de datos está en UTC. Lo que ve la clínica y
 * el paciente está en `CLINIC_TIMEZONE` (por defecto America/Bogota). Estas
 * funciones son el puente entre ambos mundos.
 */

const PARTS_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = PARTS_FORMATTER_CACHE.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    PARTS_FORMATTER_CACHE.set(timeZone, fmt);
  }
  return fmt;
}

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number;
  second: number;
}

/** Descompone un instante UTC en sus partes de calendario dentro de `timeZone`. */
export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const bag: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    // Intl puede devolver "24" para medianoche en el ciclo h23/h24.
    hour: Number(bag.hour) % 24,
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

/** Desfase de la zona respecto de UTC, en milisegundos, para ese instante. */
export function getTimezoneOffsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/**
 * Convierte una hora de pared de la zona a un instante UTC.
 * Se calcula dos veces para resolver correctamente los saltos de horario de
 * verano (Colombia no los tiene, pero la función queda válida para cualquier zona).
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstOffset = getTimezoneOffsetMs(new Date(naive), timeZone);
  let timestamp = naive - firstOffset;
  const secondOffset = getTimezoneOffsetMs(new Date(timestamp), timeZone);
  if (secondOffset !== firstOffset) timestamp = naive - secondOffset;
  return new Date(timestamp);
}

/** Convierte "2026-03-14" + "08:30" (hora local de la clínica) a un Date UTC. */
export function parseZonedDateTime(
  isoDate: string,
  time: string,
  timeZone: string,
): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) {
    throw new Error(`Fecha u hora inválida: "${isoDate}" "${time}"`);
  }
  return zonedTimeToUtc(year, month, day, hour, minute, timeZone);
}

/** Devuelve "YYYY-MM-DD" según la zona indicada. */
export function toZonedDateKey(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Devuelve "HH:mm" según la zona indicada. */
export function toZonedTime(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/** Día de la semana en la zona indicada (0 = domingo … 6 = sábado). */
export function getZonedDayOfWeek(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
}

const LONG_DATE_CACHE = new Map<string, Intl.DateTimeFormat>();

/** "viernes, 14 de marzo de 2026, 8:30 a. m." */
export function formatLongEs(date: Date, timeZone: string): string {
  let fmt = LONG_DATE_CACHE.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('es-CO', {
      timeZone,
      dateStyle: 'full',
      timeStyle: 'short',
    });
    LONG_DATE_CACHE.set(timeZone, fmt);
  }
  return fmt.format(date);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * El día de MAÑANA en la clínica: de su medianoche a la siguiente.
 *
 * Existe porque «mañana» no es «dentro de 24 horas», y confundirlos manda
 * mensajes con un día de error. La tarea automática corre a las 9 de la
 * mañana y filtraba entre `ahora + 24h` y `ahora + 48h`: una cita del sábado
 * a las 8:30 cae en esa ventana ya el jueves, así que el paciente recibía el
 * jueves un mensaje que dice «mañana» refiriéndose al sábado. Y como al
 * enviarlo queda sellado `whatsappReminderSentAt`, el viernes el sistema da
 * esa cita por avisada y nadie manda el recordatorio bueno.
 *
 * Con el horario del centro eso no es un caso raro: el sábado abre a las 8:00
 * y el domingo a las 7:00, o sea todas las citas de la mañana del fin de
 * semana.
 *
 * Se calcula sobre el calendario de la zona de la clínica y no en UTC, donde
 * «mañana» empieza cinco horas antes y se cuelan las citas de esta noche.
 */
export function ventanaDeManana(
  timeZone: string,
  ahora: Date = new Date(),
): { desde: Date; hasta: Date; clave: string } {
  const inicioDeHoy = parseZonedDateTime(toZonedDateKey(ahora, timeZone), '00:00', timeZone);

  /**
   * Se salta al día siguiente sumando 24 horas y luego se vuelve a anclar a la
   * medianoche de ESE día. Sumar y ya bastaría en Colombia, que no cambia la
   * hora, pero en una zona que sí lo hace un día dura 23 o 25 horas y la suma
   * caería a las 23:00 del día anterior. Anclar cuesta una línea y quita el
   * problema para siempre.
   */
  const claveManana = toZonedDateKey(addDays(inicioDeHoy, 1), timeZone);
  const desde = parseZonedDateTime(claveManana, '00:00', timeZone);
  const clavePasado = toZonedDateKey(addDays(desde, 1), timeZone);
  const hasta = parseZonedDateTime(clavePasado, '00:00', timeZone);

  return { desde, hasta, clave: claveManana };
}

/** "08:30" -> 510 minutos desde medianoche. */
export function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

/** 510 -> "08:30" */
export function minutesToTime(total: number): string {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** ¿Se solapan [aStart, aEnd) y [bStart, bEnd)? */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
