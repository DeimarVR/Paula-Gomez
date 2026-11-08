import { HttpError } from './httpError';

const COLOMBIA_CODE = '57';

/**
 * Normaliza un teléfono al formato que exigen wa.me y la WhatsApp Cloud API:
 * solo dígitos, con indicativo de país y sin "+".
 *
 * Acepta lo que la gente realmente escribe: "300 111 2233", "+57 300 1112233",
 * "(57) 300-111-2233", "3001112233".
 */
export function normalizePhone(input: string, defaultCountry = COLOMBIA_CODE): string {
  const digits = input.replace(/\D/g, '');

  if (digits.length === 0) {
    throw HttpError.badRequest('El teléfono no puede estar vacío');
  }

  // Ya viene con indicativo colombiano: 57 + 10 dígitos.
  if (digits.startsWith(COLOMBIA_CODE) && digits.length === 12) return digits;

  // Celular colombiano sin indicativo (10 dígitos, empieza por 3).
  if (digits.length === 10 && digits.startsWith('3')) return `${defaultCountry}${digits}`;

  // Fijo local con indicativo de área (ej: 6027331234).
  if (digits.length === 10) return `${defaultCountry}${digits}`;

  // Cualquier otro número internacional razonable se deja tal cual.
  if (digits.length >= 11 && digits.length <= 15) return digits;

  throw HttpError.badRequest(
    'El número de teléfono no parece válido. Usa 10 dígitos (ej: 3001112233).',
  );
}

/** "573001112233" -> "+57 300 111 2233" (para mostrar en pantalla). */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith(COLOMBIA_CODE) && digits.length === 12) {
    const local = digits.slice(2);
    return `+57 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return `+${digits}`;
}

/** Enlace wa.me con mensaje prellenado. No requiere ningún token. */
export function buildWhatsAppLink(phone: string, message?: string): string {
  const digitos = phone.replace(/\D/g, '');
  /**
   * Sin indicativo de país, wa.me abre WhatsApp diciendo que el número no
   * existe. Diez dígitos son un número colombiano al que solo le falta el 57:
   * es lo que se escribe a mano en el mostrador. Ver el gemelo de este en
   * `src/lib/format.ts`.
   */
  const target = digitos.length === 10 ? `${COLOMBIA_CODE}${digitos}` : digitos;
  const base = `https://wa.me/${target}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
