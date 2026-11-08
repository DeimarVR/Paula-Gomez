import { env } from '@/server/config/env';
import { getZonedDayOfWeek, toZonedDateKey } from '@/server/lib/datetime';

/**
 * Leer fechas, horas y plata escritas como las escribe la gente.
 *
 * Lo usa el intérprete por reglas, pero también sirve para limpiar lo que
 * devuelve el modelo: si contesta «mañana» donde se le pidió YYYY-MM-DD, aquí
 * se arregla en vez de descartar la acción entera.
 */

/** Sin tildes, sin mayúsculas y sin espacios de más. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const DIAS = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
] as const;

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** Hoy en la clínica, no en el servidor. Vercel corre en UTC. */
export function hoyEnLaClinica(ahora = new Date()): string {
  return toZonedDateKey(ahora, env.CLINIC_TIMEZONE);
}

function sumarDias(clave: string, dias: number): string {
  const [a, m, d] = clave.split('-').map(Number);
  const fecha = new Date(Date.UTC(a, m - 1, d + dias));
  return fecha.toISOString().slice(0, 10);
}

/**
 * La fecha que menciona una frase, o null si no menciona ninguna.
 *
 * Entiende «hoy», «mañana», «pasado mañana», «el lunes» (el próximo que
 * venga), «el 15», «15/11», «15 de noviembre» y una fecha ya escrita como
 * YYYY-MM-DD.
 *
 * Cuando dicen un día de la semana se toma el PRÓXIMO, incluido hoy si hoy es
 * ese día: en un consultorio «el viernes» dicho un viernes por la mañana es
 * hoy, no dentro de ocho días.
 */
export function fechaDeLaFrase(frase: string, ahora = new Date()): string | null {
  const t = normalizar(frase);
  const hoy = hoyEnLaClinica(ahora);

  const yaEscrita = t.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (yaEscrita) return yaEscrita[1];

  if (/\bpasado manana\b/.test(t)) return sumarDias(hoy, 2);
  if (/\bmanana\b/.test(t)) return sumarDias(hoy, 1);
  if (/\bayer\b/.test(t)) return sumarDias(hoy, -1);
  if (/\bhoy\b/.test(t)) return hoy;

  const diaSemana = DIAS.findIndex((d) => new RegExp(`\\b${d}s?\\b`).test(t));
  if (diaSemana >= 0) {
    const actual = getZonedDayOfWeek(ahora, env.CLINIC_TIMEZONE);
    let faltan = (diaSemana - actual + 7) % 7;
    // «el próximo viernes» dicho un viernes sí significa el de la otra semana.
    if (faltan === 0 && /\b(proximo|siguiente|entrante)\b/.test(t)) faltan = 7;
    return sumarDias(hoy, faltan);
  }

  const conMes = t.match(/\b(\d{1,2})\s*(?:de\s+)?([a-z]+)\b/);
  if (conMes) {
    const mes = MESES.findIndex((m) => m.startsWith(conMes[2].slice(0, 4)));
    if (mes >= 0) {
      const dia = Number(conMes[1]);
      if (dia >= 1 && dia <= 31) {
        const anio = Number(hoy.slice(0, 4));
        return `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      }
    }
  }

  const barras = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (barras) {
    const dia = Number(barras[1]);
    const mes = Number(barras[2]);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      let anio = barras[3] ? Number(barras[3]) : Number(hoy.slice(0, 4));
      if (anio < 100) anio += 2000;
      return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * La hora que menciona una frase, en HH:MM de 24 horas.
 *
 * Entiende «a las 3», «3pm», «15:30», «3 y media». Sin «am» ni «pm», una hora
 * entre la 1 y la 6 se toma como de la tarde: en un consultorio que abre por
 * la mañana y atiende hasta la tarde, «a las 3» nunca son las tres de la
 * madrugada.
 */
export function horaDeLaFrase(frase: string): string | null {
  const t = normalizar(frase);

  const m = t.match(/\b(?:a\s+las?\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:y\s+(media|cuarto))?\s*(am|pm|de la manana|de la tarde|de la noche)?/);
  if (!m) return null;

  let horas = Number(m[1]);
  if (horas > 23) return null;

  let minutos = m[2] ? Number(m[2]) : 0;
  if (m[3] === 'media') minutos = 30;
  if (m[3] === 'cuarto') minutos = 15;
  if (minutos > 59) return null;

  const sufijo = m[4];
  const esTarde = sufijo === 'pm' || sufijo === 'de la tarde' || sufijo === 'de la noche';
  const esManana = sufijo === 'am' || sufijo === 'de la manana';

  if (esTarde && horas < 12) horas += 12;
  else if (esManana && horas === 12) horas = 0;
  else if (!sufijo && horas >= 1 && horas <= 6) horas += 12;

  // Una cifra suelta sin «a las» ni sufijo no es una hora, es un número.
  if (!m[2] && !m[3] && !sufijo && !/a\s+las?\s+\d/.test(t)) return null;

  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

/**
 * La plata que menciona una frase, en pesos enteros.
 *
 * Entiende «50000», «50.000», «$50,000», «50 mil», «1 millón», «50k». Lo que
 * NO hace es adivinar: «50» a secas son cincuenta pesos, no cincuenta mil. Si
 * alguien escribe una cifra rara, mejor que el formulario salga con el número
 * literal y lo corrija de un vistazo, a que el asistente multiplique por mil
 * por su cuenta.
 */
export function plataDeLaFrase(frase: string): number | null {
  const t = normalizar(frase);

  const conPalabra = t.match(/(\d+(?:[.,]\d+)?)\s*(mil|millon(?:es)?|k|m)\b/);
  if (conPalabra) {
    const base = Number(conPalabra[1].replace(',', '.'));
    const factor = /^(mil|k)$/.test(conPalabra[2]) ? 1_000 : 1_000_000;
    const total = Math.round(base * factor);
    return Number.isFinite(total) && total > 0 ? total : null;
  }

  const suelta = t.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d+)/);
  if (suelta) {
    const limpio = suelta[1].replace(/[.,]/g, '');
    const total = Number(limpio);
    return Number.isFinite(total) && total > 0 ? total : null;
  }

  return null;
}

/**
 * Lo que queda de la frase después de quitarle la orden.
 *
 * Sirve para sacar el nombre de «búscame el paciente juan moncayo» sin que el
 * «búscame el paciente» se cuele en la búsqueda.
 */
export function loQueQueda(frase: string, ...quitar: RegExp[]): string {
  let resto = frase;
  for (const patron of quitar) resto = resto.replace(patron, ' ');
  return resto.replace(/\s+/g, ' ').trim();
}
