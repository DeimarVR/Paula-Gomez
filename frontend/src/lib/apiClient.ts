'use client';

/**
 * Cliente HTTP del navegador.
 *
 * Se usa en los formularios públicos y en todo el panel. El token de sesión
 * se guarda en `localStorage` bajo una única clave y se adjunta solo en las
 * rutas privadas.
 */

/**
 * Las rutas van relativas: la API vive en el mismo despliegue, bajo /api.
 * Antes apuntaban a otro dominio y por eso hacía falta NEXT_PUBLIC_API_URL y
 * toda la configuración de CORS; ahora ni una cosa ni la otra.
 */
const TOKEN_KEY = 'clinica.token';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Array<{ field: string; message: string }>;

  constructor(
    status: number,
    message: string,
    code = 'error',
    details?: Array<{ field: string; message: string }>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Mensaje del primer campo inválido, listo para mostrar bajo el input. */
  fieldMessage(field: string): string | undefined {
    return this.details?.find((detail) => detail.field === field)?.message;
  }
}

/**
 * El texto que de verdad se enseña cuando algo no cumple.
 *
 * Cuando el servidor rechaza un formulario manda dos cosas: un titular genérico
 * —«Los datos enviados no son válidos»— y una lista con el campo y el motivo de
 * cada fallo. El panel solo mostraba el titular, así que en pantalla salía un
 * error rojo que no decía cuál de los diez campos estaba mal ni por qué; había
 * que adivinar campo por campo. La información existía y se estaba tirando a la
 * basura.
 *
 * Aquí el titular se cambia por los motivos, que es lo único que ayuda a
 * arreglarlo. Se hace en el cliente y no en cada formulario para que lo
 * aprovechen todas las pantallas del panel de una vez.
 */
function mensajeUtil(titular: string, details?: Array<{ field: string; message: string }>): string {
  if (!details?.length) return titular;
  const motivos = details.map((detalle) => detalle.message.trim()).filter(Boolean);
  if (motivos.length === 0) return titular;
  // Sin repetir: dos campos que fallan por lo mismo no tienen que decirlo dos veces.
  return [...new Set(motivos)].join(' · ');
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Adjunta el token de sesión. Por defecto `true` fuera de `/api/public`. */
  auth?: boolean;
  signal?: AbortSignal;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  const auth = options.auth ?? !path.startsWith('/api/public');

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    signal,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();

  /**
   * La respuesta puede NO ser JSON.
   *
   * Cuando una ruta de la API falla al compilar o al cargar, Next contesta con
   * su página de error en HTML. Parsear eso a ciegas hacía que el panel
   * mostrara "Unexpected token '<'", que no le dice nada a nadie: el problema
   * real es del servidor, no del formato. Aquí se distingue una cosa de la
   * otra.
   */
  let payload: Record<string, unknown> = {};
  if (text) {
    try {
      payload = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ApiError(
        response.status,
        response.ok
          ? 'El servidor respondió algo que no es JSON. Revisa la consola del servidor.'
          : `El servidor falló al responder (HTTP ${response.status}). Revisa la consola del servidor.`,
        'respuesta_no_json',
      );
    }
  }

  if (!response.ok) {
    // Sesión vencida: se limpia el token para forzar un nuevo inicio de sesión.
    if (response.status === 401 && auth) clearToken();

    const details = payload.details as Array<{ field: string; message: string }> | undefined;

    throw new ApiError(
      response.status,
      mensajeUtil(
        (payload.message as string) ?? 'No pudimos completar la solicitud',
        details,
      ),
      (payload.error as string) ?? 'error',
      details,
    );
  }

  return payload as T;
}

/**
 * Descarga un archivo de una ruta privada.
 *
 * No se puede resolver con un `<a href>` y ya: el token de sesión viaja en una
 * cabecera, y un enlace normal no la lleva — el servidor respondería 401 y el
 * usuario vería un archivo de error en vez de su Excel. Así que se pide con
 * `fetch`, se recibe el archivo entero en memoria y se dispara la descarga con
 * un enlace temporal.
 *
 * El nombre lo pone el servidor en `Content-Disposition`; si no viene, se usa
 * el de reserva. Y el objeto temporal se libera siempre, también cuando algo
 * falla: cada uno retiene el archivo completo en memoria hasta que se suelta.
 */
export async function descargar(path: string, nombreDeReserva: string): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, { headers });

  if (!response.ok) {
    if (response.status === 401) clearToken();

    // El error sí viene en JSON; se aprovecha para decir qué pasó.
    let mensaje = `No pudimos generar el archivo (HTTP ${response.status})`;
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload?.message) mensaje = payload.message;
    } catch {
      // Si ni siquiera eso es JSON, se queda el mensaje genérico.
    }
    throw new ApiError(response.status, mensaje, 'descarga_fallida');
  }

  const nombre = nombreDelEncabezado(response.headers.get('Content-Disposition')) ?? nombreDeReserva;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();

  /**
   * El objeto temporal se libera DESPUÉS, no en un `finally`.
   *
   * `click()` solo arranca la descarga; el navegador la resuelve después, y si
   * el objeto ya se soltó para entonces se queda sin el nombre —el archivo baja
   * como «download»— o directamente se cae. Con el archivo entero retenido en
   * memoria, esperar un rato es barato; soltarlo antes de tiempo no.
   */
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Saca el nombre del archivo de `Content-Disposition`, con tildes incluidas. */
function nombreDelEncabezado(encabezado: string | null): string | null {
  if (!encabezado) return null;

  // `filename*=UTF-8''...` es el que conserva las tildes; se prefiere.
  const conAcentos = /filename\*=UTF-8''([^;]+)/i.exec(encabezado);
  if (conAcentos) {
    try {
      return decodeURIComponent(conAcentos[1]);
    } catch {
      // Un porcentaje mal formado no puede tumbar la descarga.
    }
  }

  const simple = /filename="([^"]+)"/i.exec(encabezado);
  return simple ? simple[1] : null;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
  descargar,
};
