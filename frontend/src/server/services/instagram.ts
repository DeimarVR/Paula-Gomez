import { InstagramMediaType, type InstagramPost } from '@prisma/client';
import { env, instagramConfigured } from '../config/env';
import { prisma } from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { HttpError } from '../lib/httpError';
import { daysUntilExpiry, getToken, recordTokenError, saveToken } from './tokenStore';

const log = createLogger('instagram');

const GRAPH = 'https://graph.instagram.com';
const OAUTH = 'https://api.instagram.com';

/**
 * Un token de larga duración de Instagram dura 60 días. Se renueva cuando le
 * quedan menos de estos días, así que en la práctica nunca llega a expirar
 * mientras el cron diario siga corriendo.
 */
const REFRESH_WHEN_DAYS_LEFT = 30;

/**
 * Meta rechaza el refresco si el token tiene menos de 24 horas de vida.
 * Dejamos un margen de 25 horas para no chocar con ese límite.
 */
const MIN_HOURS_BETWEEN_REFRESH = 25;

const MEDIA_FIELDS = [
  'id',
  'caption',
  'media_type',
  'media_url',
  'permalink',
  'thumbnail_url',
  'timestamp',
  'username',
].join(',');

interface IgMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  permalink: string;
  thumbnail_url?: string;
  timestamp: string;
  username?: string;
}

async function igFetch<T>(url: string, context: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await response.text();

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${context}: respuesta no JSON (HTTP ${response.status}) ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const detail = (payload as { error?: { message?: string } })?.error?.message ?? text.slice(0, 200);
    throw new Error(`${context}: ${detail} (HTTP ${response.status})`);
  }

  return payload as T;
}

// ---------------------------------------------------------------------------
// Conexión inicial (OAuth) — se hace UNA sola vez desde el panel
// ---------------------------------------------------------------------------

/** URL a la que se envía al administrador para autorizar la cuenta. */
export function buildAuthUrl(state: string): string {
  if (!instagramConfigured || !env.INSTAGRAM_REDIRECT_URI) {
    throw HttpError.serviceUnavailable(
      'Faltan INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET o INSTAGRAM_REDIRECT_URI',
    );
  }
  const params = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID!,
    redirect_uri: env.INSTAGRAM_REDIRECT_URI,
    scope: 'instagram_business_basic',
    response_type: 'code',
    state,
  });
  return `${OAUTH}/oauth/authorize?${params.toString()}`;
}

/**
 * Canjea el `code` del callback por un token de larga duración (60 días) y lo
 * guarda. A partir de aquí el cron se encarga de mantenerlo vivo solo.
 */
export async function exchangeCodeForLongLivedToken(code: string): Promise<Date | null> {
  if (!instagramConfigured || !env.INSTAGRAM_REDIRECT_URI) {
    throw HttpError.serviceUnavailable('Instagram no está configurado');
  }

  const form = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID!,
    client_secret: env.INSTAGRAM_APP_SECRET!,
    grant_type: 'authorization_code',
    redirect_uri: env.INSTAGRAM_REDIRECT_URI,
    code,
  });

  const short = await (async () => {
    const response = await fetch(`${OAUTH}/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Canje de código falló: ${text.slice(0, 250)}`);
    return JSON.parse(text) as { access_token: string; user_id?: string | number };
  })();

  const long = await igFetch<{ access_token: string; expires_in: number }>(
    `${GRAPH}/access_token?grant_type=ig_exchange_token` +
      `&client_secret=${encodeURIComponent(env.INSTAGRAM_APP_SECRET!)}` +
      `&access_token=${encodeURIComponent(short.access_token)}`,
    'Intercambio a token de larga duración',
  );

  const expiresAt = new Date(Date.now() + long.expires_in * 1000);
  await saveToken('instagram', {
    accessToken: long.access_token,
    expiresAt,
    scope: 'instagram_business_basic',
    accountId: short.user_id ? String(short.user_id) : null,
    accountName: env.INSTAGRAM_USERNAME,
  });

  log.info(`Cuenta conectada. Token válido hasta ${expiresAt.toISOString()}`);
  return expiresAt;
}

// ---------------------------------------------------------------------------
// Token vigente + renovación automática
// ---------------------------------------------------------------------------

/**
 * Devuelve el token utilizable. Si en base de datos no hay ninguno pero sí
 * existe `INSTAGRAM_ACCESS_TOKEN` en el entorno, lo adopta como semilla.
 */
export async function getActiveAccessToken(): Promise<string | null> {
  const stored = await getToken('instagram');
  if (stored?.accessToken) return stored.accessToken;

  if (env.INSTAGRAM_ACCESS_TOKEN) {
    log.info('Adoptando INSTAGRAM_ACCESS_TOKEN del entorno como token inicial');
    const seeded = await saveToken('instagram', {
      accessToken: env.INSTAGRAM_ACCESS_TOKEN,
      // Asumimos lo peor sobre su antigüedad: el cron lo renovará y a partir
      // de ese momento la fecha real quedará registrada.
      expiresAt: new Date(Date.now() + 60 * 86_400_000),
      accountName: env.INSTAGRAM_USERNAME,
    });
    return seeded.accessToken;
  }

  return null;
}

export interface RefreshResult {
  refreshed: boolean;
  reason: string;
  expiresAt?: Date | null;
  daysLeft?: number | null;
}

/**
 * Renueva el token de larga duración. Idempotente y segura de llamar tantas
 * veces como se quiera: solo llama a Meta cuando de verdad hace falta.
 *
 * `force` salta la comprobación de "aún le quedan muchos días", pero nunca la
 * de las 24 horas mínimas, porque esa la impone Meta.
 */
export async function refreshAccessToken(force = false): Promise<RefreshResult> {
  const token = await getToken('instagram');
  const accessToken = token?.accessToken ?? (await getActiveAccessToken());

  if (!accessToken) {
    return { refreshed: false, reason: 'No hay ningún token de Instagram guardado' };
  }

  const daysLeft = daysUntilExpiry(token);

  if (!force && daysLeft !== null && daysLeft > REFRESH_WHEN_DAYS_LEFT) {
    return {
      refreshed: false,
      reason: `Todavía es válido ${daysLeft} días; se renovará cuando queden ${REFRESH_WHEN_DAYS_LEFT}`,
      expiresAt: token?.expiresAt ?? null,
      daysLeft,
    };
  }

  if (daysLeft !== null && daysLeft <= 0) {
    const message =
      'El token expiró. Hay que volver a conectar la cuenta desde el panel (/api/integrations/instagram/connect).';
    await recordTokenError('instagram', message);
    return { refreshed: false, reason: message, expiresAt: token?.expiresAt ?? null, daysLeft };
  }

  const lastRefresh = token?.lastRefreshedAt?.getTime();
  if (lastRefresh) {
    const hoursSince = (Date.now() - lastRefresh) / 3_600_000;
    if (hoursSince < MIN_HOURS_BETWEEN_REFRESH) {
      return {
        refreshed: false,
        reason: `Meta exige 24 h entre renovaciones; van ${hoursSince.toFixed(1)} h`,
        expiresAt: token?.expiresAt ?? null,
        daysLeft,
      };
    }
  }

  try {
    const result = await igFetch<{ access_token: string; expires_in: number }>(
      `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token` +
        `&access_token=${encodeURIComponent(accessToken)}`,
      'Renovación de token',
    );

    const expiresAt = new Date(Date.now() + result.expires_in * 1000);
    await saveToken('instagram', {
      accessToken: result.access_token,
      expiresAt,
      accountId: token?.accountId ?? null,
      accountName: token?.accountName ?? env.INSTAGRAM_USERNAME,
      countRefresh: true,
    });

    log.info(`Token renovado. Nueva expiración: ${expiresAt.toISOString()}`);
    return {
      refreshed: true,
      reason: 'Token renovado por 60 días más',
      expiresAt,
      daysLeft: 60,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('No se pudo renovar el token', message);
    await recordTokenError('instagram', message);
    return { refreshed: false, reason: message, expiresAt: token?.expiresAt ?? null, daysLeft };
  }
}

// ---------------------------------------------------------------------------
// Sincronización del feed
// ---------------------------------------------------------------------------

function mapMediaType(raw: string): InstagramMediaType {
  if (raw === 'VIDEO') return InstagramMediaType.VIDEO;
  if (raw === 'CAROUSEL_ALBUM') return InstagramMediaType.CAROUSEL_ALBUM;
  return InstagramMediaType.IMAGE;
}

export interface SyncResult {
  ok: boolean;
  fetched: number;
  saved: number;
  message: string;
}

/**
 * Baja las últimas publicaciones y las guarda en base de datos.
 *
 * La landing lee siempre de la copia local: si Meta falla o el token está en
 * mantenimiento, la web sigue mostrando el último feed conocido en lugar de
 * un hueco vacío.
 */
export async function syncPosts(limit = 12): Promise<SyncResult> {
  const accessToken = await getActiveAccessToken();
  if (!accessToken) {
    return { ok: false, fetched: 0, saved: 0, message: 'Instagram no está conectado' };
  }

  try {
    const url =
      `${GRAPH}/${env.INSTAGRAM_API_VERSION}/me/media` +
      `?fields=${MEDIA_FIELDS}&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`;
    const response = await igFetch<{ data: IgMedia[] }>(url, 'Lectura del feed');
    const items = response.data ?? [];

    let saved = 0;
    for (const item of items) {
      const mediaType = mapMediaType(item.media_type);
      // Los videos traen media_url del archivo y thumbnail_url de la portada.
      const mediaUrl = item.media_url ?? item.thumbnail_url;
      if (!mediaUrl) continue;

      const data = {
        caption: item.caption ?? null,
        mediaType,
        mediaUrl,
        thumbnailUrl: item.thumbnail_url ?? null,
        permalink: item.permalink,
        username: item.username ?? env.INSTAGRAM_USERNAME,
        postedAt: new Date(item.timestamp),
        syncedAt: new Date(),
      };

      await prisma.instagramPost.upsert({
        where: { igId: item.id },
        create: { igId: item.id, ...data },
        update: data,
      });
      saved += 1;
    }

    log.info(`Feed sincronizado: ${saved} publicaciones`);
    return {
      ok: true,
      fetched: items.length,
      saved,
      message: `${saved} publicaciones sincronizadas`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Falló la sincronización del feed', message);
    await recordTokenError('instagram', message);
    return { ok: false, fetched: 0, saved: 0, message };
  }
}

/** Publicaciones que se muestran en la landing (desde la copia local). */
export async function getCachedPosts(limit = 8): Promise<InstagramPost[]> {
  return prisma.instagramPost.findMany({
    where: { hidden: false },
    orderBy: { postedAt: 'desc' },
    take: limit,
  });
}

/**
 * Qué ve el token de Instagram: a qué cuenta pertenece y cuántas
 * publicaciones tiene esa cuenta.
 *
 * Existe por el mismo motivo que el diagnóstico del calendario. «No salen las
 * publicaciones» tiene al menos cuatro causas que se ven igual desde fuera: no
 * hay token, el token está caducado, el token es de OTRA cuenta de Instagram
 * —muy fácil de provocar: basta con generarlo teniendo abierta otra sesión—, o
 * la cuenta es correcta y no tiene nada publicado. Adivinar entre las cuatro
 * cuesta horas; preguntárselo a Meta cuesta dos llamadas.
 */
export interface Diagnostico {
  /** De dónde sale el token que se está usando, o `null` si no hay ninguno. */
  origenDelToken: 'base de datos' | 'entorno' | null;
  /** La cuenta a la que pertenece el token, según Meta. */
  cuenta: { id: string; username: string } | null;
  /** Cuántas publicaciones tiene esa cuenta (se miran hasta 25). */
  publicacionesEnMeta: number | null;
  /** Cuántas hay en nuestra copia local, que es la que lee la portada. */
  publicacionesGuardadas: number;
  /** La cuenta que el sitio dice ser: `INSTAGRAM_USERNAME`. */
  usernameEsperado: string;
  /** Si el token es de la cuenta que esperábamos. Lo que más falla. */
  coincide: boolean | null;
  /** El mensaje de Meta tal cual, si algo falló. */
  error: string | null;
}

export async function diagnosticar(): Promise<Diagnostico> {
  const guardado = await getToken('instagram');
  const accessToken = guardado?.accessToken ?? env.INSTAGRAM_ACCESS_TOKEN ?? null;

  const base: Diagnostico = {
    origenDelToken: guardado?.accessToken
      ? 'base de datos'
      : env.INSTAGRAM_ACCESS_TOKEN
        ? 'entorno'
        : null,
    cuenta: null,
    publicacionesEnMeta: null,
    publicacionesGuardadas: await prisma.instagramPost.count(),
    usernameEsperado: env.INSTAGRAM_USERNAME,
    coincide: null,
    error: null,
  };

  if (!accessToken) {
    return {
      ...base,
      error: 'No hay ningún token: ni guardado en la base ni en INSTAGRAM_ACCESS_TOKEN.',
    };
  }

  try {
    const yo = await igFetch<{ id: string; username?: string }>(
      `${GRAPH}/${env.INSTAGRAM_API_VERSION}/me?fields=id,username` +
        `&access_token=${encodeURIComponent(accessToken)}`,
      'Identidad del token',
    );
    // Solo los identificadores: es para contar, no para mostrar.
    const media = await igFetch<{ data: Array<{ id: string }> }>(
      `${GRAPH}/${env.INSTAGRAM_API_VERSION}/me/media?fields=id&limit=25` +
        `&access_token=${encodeURIComponent(accessToken)}`,
      'Conteo del feed',
    );

    const username = yo.username ?? '';
    return {
      ...base,
      cuenta: { id: yo.id, username },
      publicacionesEnMeta: media.data?.length ?? 0,
      coincide: username.toLowerCase() === env.INSTAGRAM_USERNAME.toLowerCase(),
    };
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Estado de la integración para el panel administrativo. */
export async function getStatus() {
  const token = await getToken('instagram');
  const [postCount, latest] = await Promise.all([
    prisma.instagramPost.count(),
    prisma.instagramPost.findFirst({ orderBy: { syncedAt: 'desc' } }),
  ]);

  return {
    configured: instagramConfigured,
    connected: Boolean(token?.accessToken),
    /**
     * Si se puede pedir el feed, aunque nadie haya pasado por el OAuth.
     *
     * `connected` mira la base de datos, y ahí solo hay algo después de una
     * conexión o de una sincronización. Pero con `INSTAGRAM_ACCESS_TOKEN` en el
     * entorno ya se puede bajar el feed: la primera sincronización adopta ese
     * token y lo guarda. Sin esta distinción el panel escondía el botón de
     * sincronizar justo cuando hacía falta, y no quedaba forma de arrancar.
     */
    usable: Boolean(token?.accessToken) || Boolean(env.INSTAGRAM_ACCESS_TOKEN),
    username: token?.accountName ?? env.INSTAGRAM_USERNAME,
    expiresAt: token?.expiresAt ?? null,
    daysUntilExpiry: daysUntilExpiry(token),
    lastRefreshedAt: token?.lastRefreshedAt ?? null,
    refreshCount: token?.refreshCount ?? 0,
    lastError: token?.lastError ?? null,
    postCount,
    lastSyncedAt: latest?.syncedAt ?? null,
    autoRefresh: {
      // La renovación ya no la agenda este proceso —en serverless no hay
      // proceso que la agende—: la dispara la tarea diaria declarada en
      // vercel.json. Y esa tarea solo corre si CRON_SECRET está configurado,
      // porque sin él la ruta responde 401. Así que esto no es un adorno:
      // dice de verdad si el token se va a renovar solo o no.
      enabled: Boolean(process.env.CRON_SECRET),
      cron: 'una vez al día · /api/cron/diario',
      renewsWhenDaysLeft: REFRESH_WHEN_DAYS_LEFT,
    },
  };
}
