import { google, type calendar_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { env, googleConfigured } from '../config/env';
import { createLogger } from '../lib/logger';
import { HttpError } from '../lib/httpError';
import { clearTokenError, getToken, recordTokenError, saveToken } from './tokenStore';

const log = createLogger('google-calendar');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
];

function baseClient(): OAuth2Client {
  if (!googleConfigured) {
    throw HttpError.serviceUnavailable(
      'Google Calendar no está configurado (faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI)',
    );
  }
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );
}

/** URL de consentimiento. `access_type=offline` es lo que entrega el refresh token. */
export function buildAuthUrl(state: string): string {
  return baseClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

/** Guarda el refresh token que devuelve el callback de OAuth. */
export async function handleOAuthCallback(code: string): Promise<void> {
  const client = baseClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw HttpError.badRequest(
      'Google no devolvió refresh_token. Revoca el acceso en myaccount.google.com/permissions y vuelve a conectar.',
    );
  }

  await saveToken('google_calendar', {
    accessToken: tokens.access_token ?? '',
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scope: tokens.scope ?? SCOPES.join(' '),
    accountName: env.GOOGLE_CALENDAR_ID,
  });

  log.info('Google Calendar conectado');
}

/**
 * Cliente autenticado y listo para usar, o `null` si la clínica todavía no
 * conectó su calendario. Devolver `null` en vez de lanzar es intencional: una
 * reserva nunca debe perderse solo porque la agenda de Google no responda.
 */
async function getAuthedClient(): Promise<OAuth2Client | null> {
  if (!googleConfigured) return null;

  const stored = await getToken('google_calendar');
  const refreshToken = stored?.refreshToken ?? env.GOOGLE_REFRESH_TOKEN;
  if (!refreshToken) return null;

  const client = baseClient();
  client.setCredentials({ refresh_token: refreshToken });

  // googleapis renueva el access token solo; aquí solo persistimos el nuevo
  // valor para que quede registro del estado de la integración.
  client.on('tokens', (tokens) => {
    if (!tokens.access_token) return;
    void saveToken('google_calendar', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      accountName: env.GOOGLE_CALENDAR_ID,
      countRefresh: true,
    }).catch((error) => log.warn('No se pudo persistir el token renovado', error));
  });

  return client;
}

async function getCalendar(): Promise<calendar_v3.Calendar | null> {
  const auth = await getAuthedClient();
  if (!auth) return null;
  return google.calendar({ version: 'v3', auth });
}

export interface CalendarEventInput {
  summary: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  attendeeEmail?: string | null;
  attendeeName?: string;
  location?: string;
}

export interface CalendarEventResult {
  eventId: string;
  htmlLink: string | null;
}

/**
 * Traduce el fallo de Google a algo que se pueda arreglar.
 *
 * El caso que costó una tarde: `events.insert` contra un calendario secundario
 * devuelve un escueto **«Not Found»** cuando la cuenta que autorizó no tiene
 * acceso a ESE calendario. No es que la cita esté mal ni que el token haya
 * caducado —la integración dice «Conectado» y todo—, es que se conectó una
 * cuenta y se apuntó al calendario de otra. Guardar el 404 tal cual no le dice
 * nada a nadie; guardar el identificador del calendario sí.
 */
function explicar(error: unknown): string {
  const mensaje = error instanceof Error ? error.message : String(error);
  const codigo = (error as { code?: number | string; status?: number })?.code;
  const estado = (error as { status?: number })?.status;
  const esNoEncontrado =
    codigo === 404 || codigo === '404' || estado === 404 || /not found/i.test(mensaje);

  if (!esNoEncontrado) return mensaje;

  return (
    `No se encuentra el calendario "${env.GOOGLE_CALENDAR_ID}". ` +
    'Casi siempre es que la cuenta de Google que se conectó no tiene acceso a ese ' +
    'calendario: o se conectó una cuenta distinta de la que lo creó, o el calendario ' +
    'no está compartido con ella. Revisa cuáles ve la cuenta conectada desde ' +
    'Integraciones, y pon ese identificador en GOOGLE_CALENDAR_ID.'
  );
}

/** Crea el evento en la agenda de la clínica. `null` si Google no está conectado. */
export async function createEvent(
  input: CalendarEventInput,
): Promise<CalendarEventResult | null> {
  const calendar = await getCalendar();
  if (!calendar) {
    log.warn('Cita guardada sin sincronizar: Google Calendar no está conectado');
    return null;
  }

  try {
    const { data } = await calendar.events.insert({
      calendarId: env.GOOGLE_CALENDAR_ID,
      sendUpdates: input.attendeeEmail ? 'all' : 'none',
      requestBody: {
        summary: input.summary,
        description: input.description,
        location: input.location ?? env.CLINIC_ADDRESS,
        start: { dateTime: input.startsAt.toISOString(), timeZone: env.CLINIC_TIMEZONE },
        end: { dateTime: input.endsAt.toISOString(), timeZone: env.CLINIC_TIMEZONE },
        attendees: input.attendeeEmail
          ? [{ email: input.attendeeEmail, displayName: input.attendeeName }]
          : undefined,
        /*
         * «Disponible» para Google. Las citas del sistema ya se cuentan desde
         * la base; si además contaran como ocupado en Google, una cita se
         * estorbaría a sí misma al moverla diez minutos, y el hueco de una
         * cancelada seguiría tapado hasta que Google se enterara. Así, lo que
         * Google marca como ocupado es solo lo que la especialista anotó a
         * mano: una reunión, un viaje, una tarde libre.
         */
        transparency: 'transparent',
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 24 * 60 },
            { method: 'popup', minutes: 60 },
          ],
        },
      },
    });

    // Si venía de un fallo, esto es la prueba de que ya está resuelto.
    await clearTokenError('google_calendar');

    return { eventId: data.id!, htmlLink: data.htmlLink ?? null };
  } catch (error) {
    const message = explicar(error);
    log.error('No se pudo crear el evento', message);
    await recordTokenError('google_calendar', message);
    return null;
  }
}

export async function updateEvent(
  eventId: string,
  input: Partial<CalendarEventInput> & {
    /** Marca el evento como «disponible»: ver `createEvent`. */
    transparente?: boolean;
  },
): Promise<boolean> {
  const calendar = await getCalendar();
  if (!calendar) return false;

  try {
    await calendar.events.patch({
      calendarId: env.GOOGLE_CALENDAR_ID,
      eventId,
      requestBody: {
        ...(input.summary ? { summary: input.summary } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.startsAt
          ? { start: { dateTime: input.startsAt.toISOString(), timeZone: env.CLINIC_TIMEZONE } }
          : {}),
        ...(input.endsAt
          ? { end: { dateTime: input.endsAt.toISOString(), timeZone: env.CLINIC_TIMEZONE } }
          : {}),
        ...(input.transparente ? { transparency: 'transparent' } : {}),
      },
    });
    return true;
  } catch (error) {
    log.error('No se pudo actualizar el evento', error);
    return false;
  }
}

export async function deleteEvent(eventId: string): Promise<boolean> {
  const calendar = await getCalendar();
  if (!calendar) return false;

  try {
    await calendar.events.delete({ calendarId: env.GOOGLE_CALENDAR_ID, eventId });
    return true;
  } catch (error) {
    log.error('No se pudo eliminar el evento', error);
    return false;
  }
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

/**
 * Franjas ocupadas según Google Calendar. Se consulta al calcular la
 * disponibilidad para que una reunión creada a mano en la agenda también
 * bloquee el horario en la web.
 */
export async function getBusyIntervals(from: Date, to: Date): Promise<BusyInterval[]> {
  const calendar = await getCalendar();
  if (!calendar) return [];

  try {
    const { data } = await calendar.freebusy.query({
      requestBody: {
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        timeZone: env.CLINIC_TIMEZONE,
        items: [{ id: env.GOOGLE_CALENDAR_ID }],
      },
    });

    const busy = data.calendars?.[env.GOOGLE_CALENDAR_ID]?.busy ?? [];
    return busy
      .filter((slot): slot is { start: string; end: string } =>
        Boolean(slot.start && slot.end),
      )
      .map((slot) => ({ start: new Date(slot.start), end: new Date(slot.end) }));
  } catch (error) {
    log.error('No se pudo consultar la disponibilidad de Google', error);
    // Si Google falla, seguimos con la disponibilidad calculada solo desde
    // nuestra base de datos en vez de bloquear todas las reservas.
    return [];
  }
}


export interface EventoDelCalendario {
  id: string;
  titulo: string;
  descripcion: string | null;
  inicio: Date;
  fin: Date;
  htmlLink: string | null;
}

/**
 * Los eventos del calendario, para el camino de vuelta.
 *
 * Hasta ahora la agenda de Google solo recibía: el sistema creaba el evento y
 * nunca volvía a mirarlo. Esto lee lo que se escribió allá a mano, que es lo
 * que permite agendar sin internet —la app de Calendar del celular guarda el
 * evento sin señal y lo sube sola cuando vuelve— y que después el sistema lo
 * recoja.
 *
 * `singleEvents` desarma las series repetidas en sus ocurrencias reales: sin
 * eso, una cita semanal llega como un solo evento con una regla de repetición
 * y habría que interpretarla acá. `showDeleted` en falso deja fuera lo que
 * alguien borró del calendario.
 */
export async function listarEventos(from: Date, to: Date): Promise<EventoDelCalendario[]> {
  const calendar = await getCalendar();
  if (!calendar) {
    throw HttpError.serviceUnavailable('La agenda de Google no está conectada.');
  }

  try {
    const { data } = await calendar.events.list({
      calendarId: env.GOOGLE_CALENDAR_ID,
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: true,
      showDeleted: false,
      orderBy: 'startTime',
      maxResults: 500,
    });

    return (data.items ?? [])
      .map((evento) => {
        // Un evento de día completo trae `date` en vez de `dateTime`. No sirve
        // como cita —no dice a qué hora— así que se descarta acá y no más
        // adelante, donde ya no se sabría por qué se cayó.
        const inicio = evento.start?.dateTime;
        const fin = evento.end?.dateTime;
        if (!evento.id || !inicio || !fin) return null;

        return {
          id: evento.id,
          titulo: (evento.summary ?? '').trim(),
          descripcion: evento.description?.trim() || null,
          inicio: new Date(inicio),
          fin: new Date(fin),
          htmlLink: evento.htmlLink ?? null,
        };
      })
      .filter((e): e is EventoDelCalendario => e !== null);
  } catch (error) {
    throw HttpError.serviceUnavailable(explicar(error));
  }
}

export interface CalendarioDisponible {
  id: string;
  nombre: string;
  /** owner, writer, reader… De reader para abajo no se pueden crear eventos. */
  acceso: string;
  principal: boolean;
  /** Es el que está puesto en GOOGLE_CALENDAR_ID. */
  enUso: boolean;
  /** Se puede escribir en él. */
  escribible: boolean;
}

/**
 * Los calendarios que la cuenta conectada ve de verdad.
 *
 * Es la respuesta a «dice Conectado pero no aparece la cita». Con la lista
 * delante se ve en un vistazo si el identificador configurado está entre ellos
 * y, si no, cuál es el bueno para copiar.
 */
export async function listarCalendarios(): Promise<CalendarioDisponible[]> {
  const calendar = await getCalendar();
  if (!calendar) {
    throw HttpError.serviceUnavailable('La agenda de Google no está conectada.');
  }

  const { data } = await calendar.calendarList.list({ maxResults: 100 });

  return (data.items ?? []).map((item) => {
    const acceso = item.accessRole ?? 'desconocido';
    return {
      id: item.id ?? '',
      nombre: item.summary ?? '(sin nombre)',
      acceso,
      principal: Boolean(item.primary),
      enUso: item.id === env.GOOGLE_CALENDAR_ID,
      escribible: acceso === 'owner' || acceso === 'writer',
    };
  });
}

export async function getStatus() {
  const stored = await getToken('google_calendar');
  return {
    configured: googleConfigured,
    connected: Boolean(stored?.refreshToken ?? env.GOOGLE_REFRESH_TOKEN),
    calendarId: env.GOOGLE_CALENDAR_ID,
    timezone: env.CLINIC_TIMEZONE,
    lastRefreshedAt: stored?.lastRefreshedAt ?? null,
    lastError: stored?.lastError ?? null,
  };
}
