import { env, whatsappConfigured } from '../config/env';
import { createLogger } from '../lib/logger';
import { buildWhatsAppLink, normalizePhone } from '../lib/phone';
import { formatLongEs } from '../lib/datetime';
import {
  fechaEnPalabras,
  horaEnPalabras,
  textoConfirmacionCita,
  textoDiaCerrado,
  textoOfertaHueco,
  textoRecordatorioCita,
  whatsappEnPalabras,
} from '@/lib/mensajesCita';
import { ESPECIALISTA } from '@/lib/config';
import { getToken, recordTokenError } from './tokenStore';

const log = createLogger('whatsapp');

/**
 * WhatsApp funciona en dos niveles y ambos están implementados:
 *
 *  1. Enlaces wa.me — no requieren token ni aprobación de Meta. Es lo que usan
 *     el botón flotante de la web y los enlaces "escríbenos". Siempre funciona.
 *
 *  2. WhatsApp Cloud API — envía confirmaciones y recordatorios automáticos.
 *     Necesita WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN. Si no están,
 *     los envíos se registran en el log y la reserva continúa sin problema.
 */

export interface SendResult {
  sent: boolean;
  reason: string;
  messageId?: string;
  /** Enlace de respaldo para que la recepción escriba manualmente. */
  fallbackLink: string;
}

async function callCloudApi(payload: Record<string, unknown>): Promise<{ id?: string }> {
  const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`WhatsApp Cloud API: ${text.slice(0, 300)} (HTTP ${response.status})`);
  }

  const data = JSON.parse(text) as { messages?: Array<{ id: string }> };
  return { id: data.messages?.[0]?.id };
}

/** Envía texto libre. Solo permitido dentro de la ventana de 24 h de Meta. */
export async function sendText(to: string, body: string): Promise<SendResult> {
  const phone = normalizePhone(to);
  const fallbackLink = buildWhatsAppLink(phone, body);

  if (!whatsappConfigured) {
    log.info(`Envío omitido (Cloud API sin configurar). Enlace manual: ${fallbackLink}`);
    return { sent: false, reason: 'WhatsApp Cloud API no configurada', fallbackLink };
  }

  try {
    const result = await callCloudApi({
      to: phone,
      type: 'text',
      text: { preview_url: true, body },
    });
    log.info(`Mensaje enviado a ${phone}`);
    return { sent: true, reason: 'Enviado', messageId: result.id, fallbackLink };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Falló el envío', message);
    await recordTokenError('whatsapp', message);
    return { sent: false, reason: message, fallbackLink };
  }
}

/**
 * Envía una plantilla aprobada. Es lo correcto para el primer contacto,
 * porque fuera de la ventana de 24 h Meta solo acepta plantillas.
 */
export async function sendTemplate(
  to: string,
  templateName: string,
  variables: string[],
  languageCode = 'es',
): Promise<SendResult> {
  const phone = normalizePhone(to);
  const fallbackLink = buildWhatsAppLink(phone, variables.join(' · '));

  if (!whatsappConfigured) {
    return { sent: false, reason: 'WhatsApp Cloud API no configurada', fallbackLink };
  }

  try {
    const result = await callCloudApi({
      to: phone,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: variables.length
          ? [
              {
                type: 'body',
                parameters: variables.map((text) => ({ type: 'text', text })),
              },
            ]
          : undefined,
      },
    });
    return { sent: true, reason: 'Plantilla enviada', messageId: result.id, fallbackLink };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Falló el envío de plantilla', message);
    return { sent: false, reason: message, fallbackLink };
  }
}

// ---------------------------------------------------------------------------
// Mensajes del negocio
// ---------------------------------------------------------------------------

export interface AppointmentMessageData {
  contactName: string;
  contactPhone: string;
  serviceName: string;
  startsAt: Date;
  manageToken: string;
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** Los datos del mensaje, resueltos desde el entorno del servidor. */
function datosDelMensaje(data: AppointmentMessageData) {
  return {
    centro: env.CLINIC_NAME,
    sede: env.CLINIC_ADDRESS,
    cuando: fechaEnPalabras(data.startsAt, env.CLINIC_TIMEZONE),
    whatsapp: whatsappEnPalabras(env.CLINIC_WHATSAPP),
  };
}

export function buildConfirmationText(data: AppointmentMessageData): string {
  return textoConfirmacionCita(datosDelMensaje(data));
}

/**
 * El mensaje de la víspera: recuerda, dice dónde es y pide respuesta.
 *
 * Lleva la sede y el WhatsApp igual que la confirmación, porque desde que se
 * juntaron los dos mensajes en uno este es el único que recibe el paciente el
 * día antes. Sale de la misma plantilla que usa el panel: el texto tiene que
 * ser idéntico salga por donde salga.
 */
export function buildReminderText(data: AppointmentMessageData): string {
  const datos = datosDelMensaje(data);
  return textoRecordatorioCita({
    centro: datos.centro,
    hora: horaEnPalabras(data.startsAt, env.CLINIC_TIMEZONE),
    sede: datos.sede,
    whatsapp: datos.whatsapp,
  });
}

/** Aviso al paciente de que su seguimiento tiene una sesión nueva registrada. */
export function buildSessionUpdateText(
  patientName: string,
  sessionNumber: number,
  totalSessions: number,
  publicToken: string,
): string {
  return [
    `Hola ${firstName(patientName)}, ya registramos tu sesión ${sessionNumber} de ${totalSessions} 💚`,
    ``,
    `Mira tus fotos de avance, las indicaciones de cuidado en casa y tu próxima cita aquí:`,
    `${env.PUBLIC_WEB_URL}/seguimiento/${publicToken}`,
    ``,
    `Este enlace es personal, no lo compartas.`,
  ].join('\n');
}

export async function sendAppointmentConfirmation(
  data: AppointmentMessageData,
): Promise<SendResult> {
  const text = buildConfirmationText(data);

  // Fuera de la ventana de 24 h Meta exige plantilla, así que si hay una
  // configurada se usa esa; si no, se intenta texto libre.
  if (whatsappConfigured && env.WHATSAPP_TEMPLATE_CONFIRMATION) {
    return sendTemplate(data.contactPhone, env.WHATSAPP_TEMPLATE_CONFIRMATION, [
      firstName(data.contactName),
      data.serviceName,
      formatLongEs(data.startsAt, env.CLINIC_TIMEZONE),
    ]);
  }

  return sendText(data.contactPhone, text);
}

export async function sendAppointmentReminder(
  data: AppointmentMessageData,
): Promise<SendResult> {
  if (whatsappConfigured && env.WHATSAPP_TEMPLATE_REMINDER) {
    return sendTemplate(data.contactPhone, env.WHATSAPP_TEMPLATE_REMINDER, [
      firstName(data.contactName),
      data.serviceName,
      formatLongEs(data.startsAt, env.CLINIC_TIMEZONE),
    ]);
  }
  return sendText(data.contactPhone, buildReminderText(data));
}

// ---------------------------------------------------------------------------
// Huecos liberados y días cerrados
// ---------------------------------------------------------------------------

export interface DatosOferta {
  /** El horario que se liberó. */
  nuevo: Date;
  /** La cita que tiene hoy la persona. */
  actual: Date;
  enlace: string;
}

export function buildOfertaHuecoText(datos: DatosOferta): string {
  return textoOfertaHueco({
    centro: env.CLINIC_NAME,
    nuevo: fechaEnPalabras(datos.nuevo, env.CLINIC_TIMEZONE),
    actual: fechaEnPalabras(datos.actual, env.CLINIC_TIMEZONE),
    enlace: datos.enlace,
  });
}

export interface DatosCierre {
  cuando: Date;
  motivo?: string | null;
  enlace: string;
}

export function buildDiaCerradoText(datos: DatosCierre): string {
  return textoDiaCerrado({
    centro: env.CLINIC_NAME,
    especialista: ESPECIALISTA.nombre,
    cuando: fechaEnPalabras(datos.cuando, env.CLINIC_TIMEZONE),
    motivo: datos.motivo,
    enlace: datos.enlace,
    whatsapp: whatsappEnPalabras(env.CLINIC_WHATSAPP),
  });
}

/**
 * Plantilla si hay, texto libre si no; y el enlace manual siempre con el texto
 * completo.
 *
 * `sendTemplate` arma su enlace de respaldo pegando las variables, que sirve
 * para salir del paso pero no para mandárselo a un paciente. Estos dos
 * mensajes los reenvía el panel a mano cuando el automático no sale, así que
 * el enlace tiene que llevar el mensaje entero, idéntico al automático.
 */
async function plantillaOTexto(
  telefono: string,
  plantilla: string | undefined,
  variables: string[],
  texto: string,
): Promise<SendResult> {
  const resultado =
    whatsappConfigured && plantilla
      ? await sendTemplate(telefono, plantilla, variables)
      : await sendText(telefono, texto);
  return { ...resultado, fallbackLink: buildWhatsAppLink(normalizePhone(telefono), texto) };
}

export function sendOfertaHueco(telefono: string, datos: DatosOferta): Promise<SendResult> {
  return plantillaOTexto(
    telefono,
    env.WHATSAPP_TEMPLATE_HUECO,
    [
      fechaEnPalabras(datos.nuevo, env.CLINIC_TIMEZONE),
      fechaEnPalabras(datos.actual, env.CLINIC_TIMEZONE),
      datos.enlace,
    ],
    buildOfertaHuecoText(datos),
  );
}

export function sendDiaCerrado(telefono: string, datos: DatosCierre): Promise<SendResult> {
  return plantillaOTexto(
    telefono,
    env.WHATSAPP_TEMPLATE_DIA_CERRADO,
    [fechaEnPalabras(datos.cuando, env.CLINIC_TIMEZONE), datos.enlace],
    buildDiaCerradoText(datos),
  );
}

/** Aviso interno a la clínica de que entró una reserva nueva. */
export async function notifyClinic(data: AppointmentMessageData): Promise<SendResult> {
  const when = formatLongEs(data.startsAt, env.CLINIC_TIMEZONE);
  const body = [
    `🔔 Nueva reserva desde la web`,
    ``,
    `Paciente: ${data.contactName}`,
    `Teléfono: ${data.contactPhone}`,
    `Tratamiento: ${data.serviceName}`,
    `Fecha: ${when}`,
  ].join('\n');

  return sendText(env.CLINIC_WHATSAPP, body);
}

/**
 * Estado para el panel.
 *
 * Es `async` por una razón concreta: incluye el último error que devolvió Meta,
 * y eso vive en base de datos. Antes el error se guardaba con
 * `recordTokenError` y no se mostraba en ninguna parte, así que un envío que
 * fallaba se veía exactamente igual que uno que salía bien — la cita se creaba,
 * el correo llegaba, y del WhatsApp no quedaba ni rastro ni explicación.
 */
export async function getStatus() {
  const token = await getToken('whatsapp');

  return {
    configured: whatsappConfigured,
    /** El mensaje de Meta tal cual, que es el que dice qué arreglar. */
    lastError: token?.lastError ?? null,
    clinicNumber: env.CLINIC_WHATSAPP,
    apiVersion: env.WHATSAPP_API_VERSION,
    templates: {
      confirmation: env.WHATSAPP_TEMPLATE_CONFIRMATION ?? null,
      reminder: env.WHATSAPP_TEMPLATE_REMINDER ?? null,
      hueco: env.WHATSAPP_TEMPLATE_HUECO ?? null,
      diaCerrado: env.WHATSAPP_TEMPLATE_DIA_CERRADO ?? null,
    },
    /** Los enlaces wa.me funcionan siempre, con o sin Cloud API. */
    deepLinksAvailable: true,
  };
}
