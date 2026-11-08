'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Instagram,
  Loader2,
  MessageCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { formatDateTime, formatPhone } from '@/lib/format';
import type { IntegrationsStatus } from '@/lib/types';

/**
 * Estado y conexión de las integraciones externas.
 *
 * El foco está en el token de Instagram: la página muestra cuántos días le
 * quedan, cuándo se renovó por última vez y cuántas veces se ha renovado solo,
 * para que el equipo pueda verificar de un vistazo que el feed no se va a caer.
 */
interface CalendarioDisponible {
  id: string;
  nombre: string;
  acceso: string;
  principal: boolean;
  enUso: boolean;
  escribible: boolean;
}

interface Diagnostico {
  calendarIdEnUso: string;
  accesible: boolean;
  calendarios: CalendarioDisponible[];
}

/** Lo que responde Meta sobre el token: de quién es y qué ve. */
interface DiagnosticoInstagram {
  origenDelToken: 'base de datos' | 'entorno' | null;
  cuenta: { id: string; username: string } | null;
  publicacionesEnMeta: number | null;
  publicacionesGuardadas: number;
  usernameEsperado: string;
  coincide: boolean | null;
  error: string | null;
}

export default function IntegracionesPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<IntegrationsStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** Diagnóstico del calendario, bajo petición: son datos de Google en vivo. */
  const [calendarios, setCalendarios] = useState<Diagnostico | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [errorCalendarios, setErrorCalendarios] = useState<string | null>(null);
  /** Lo mismo para Instagram: preguntarle a Meta en vez de suponer. */
  const [diagIg, setDiagIg] = useState<DiagnosticoInstagram | null>(null);
  const [revisandoIg, setRevisandoIg] = useState(false);
  const [errorDiagIg, setErrorDiagIg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await api.get<IntegrationsStatus>('/api/integrations/status'));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar el estado');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Mensajes que deja el callback de OAuth al volver del proveedor.
  useEffect(() => {
    if (searchParams.get('instagram') === 'ok') setNotice('Instagram quedó conectado.');
    if (searchParams.get('google') === 'ok') setNotice('Google Calendar quedó conectado.');

    const failure = searchParams.get('message');
    if (failure) setError(failure);
  }, [searchParams]);

  async function revisarCalendarios() {
    setRevisando(true);
    setErrorCalendarios(null);
    try {
      setCalendarios(await api.get<Diagnostico>('/api/integrations/google/calendarios'));
    } catch (caught) {
      setErrorCalendarios(
        caught instanceof Error ? caught.message : 'No pudimos consultar los calendarios',
      );
    } finally {
      setRevisando(false);
    }
  }

  async function connect(provider: 'instagram' | 'google') {
    setBusy(provider);
    setError(null);
    try {
      const { authUrl } = await api.get<{ authUrl: string }>(
        `/api/integrations/${provider}/connect`,
      );
      window.location.href = authUrl;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos iniciar la conexión');
      setBusy(null);
    }
  }

  async function revisarInstagram() {
    setRevisandoIg(true);
    setErrorDiagIg(null);
    try {
      setDiagIg(await api.get<DiagnosticoInstagram>('/api/integrations/instagram/diagnostico'));
    } catch (caught) {
      setErrorDiagIg(caught instanceof Error ? caught.message : 'No pudimos revisar la cuenta');
    } finally {
      setRevisandoIg(false);
    }
  }

  async function refreshInstagramToken() {
    setBusy('refresh');
    setError(null);
    setNotice(null);
    try {
      const result = await api.post<{ refreshed: boolean; reason: string }>(
        '/api/integrations/instagram/refresh',
      );
      setNotice(result.reason);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos renovar el token');
    } finally {
      setBusy(null);
    }
  }

  async function syncFeed() {
    setBusy('sync');
    setError(null);
    setNotice(null);
    try {
      const result = await api.post<{ message: string }>('/api/integrations/instagram/sync');
      setNotice(result.message);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos sincronizar el feed');
    } finally {
      setBusy(null);
    }
  }

  if (error && !status) {
    return <p className="rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>;
  }

  if (!status) {
    return (
      <div className="flex items-center gap-3 py-20 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Cargando…
      </div>
    );
  }

  const { instagram, googleCalendar, whatsapp } = status;

  // Semáforo del token: verde con margen, ámbar cerca del vencimiento, rojo vencido.
  const igDays = instagram.daysUntilExpiry;
  const igHealth =
    !instagram.connected
      ? 'off'
      : igDays === null
        ? 'ok'
        : igDays <= 0
          ? 'danger'
          : igDays <= 7
            ? 'warn'
            : 'ok';

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl">Integraciones</h1>
      <p className="mt-2 text-muted">
        Conexiones con Instagram, Google Calendar y WhatsApp.
      </p>

      {notice && (
        <p className="mt-6 rounded-2xl bg-brand-50 px-5 py-4 text-sm text-brand-800">{notice}</p>
      )}
      {error && (
        <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
      )}

      <div className="mt-9 space-y-5">
        {/* Instagram */}
        <section className="rounded-2xl border border-line bg-surface p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <Instagram className="h-5 w-5" strokeWidth={1.8} aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-xl">Instagram</h2>
                <p className="text-sm text-muted">@{instagram.username}</p>
              </div>
            </div>

            <StatusPill connected={instagram.connected} configured={instagram.configured} />
          </div>

          {!instagram.configured ? (
            <p className="mt-6 rounded-2xl bg-warn-bg px-5 py-4 text-sm text-brand-900">
              Falta configurar <code>INSTAGRAM_APP_ID</code> e{' '}
              <code>INSTAGRAM_APP_SECRET</code> en las variables de entorno (en producción, en Vercel).
            </p>
          ) : (
            <>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2">
                <Metric
                  label="Vence en"
                  value={igDays === null ? '—' : `${igDays} días`}
                  tone={igHealth}
                />
                <Metric
                  label="Última renovación"
                  value={
                    instagram.lastRefreshedAt ? formatDateTime(instagram.lastRefreshedAt) : 'Nunca'
                  }
                />
                <Metric label="Renovaciones automáticas" value={String(instagram.refreshCount)} />
                <Metric
                  label="Publicaciones guardadas"
                  value={String(instagram.postCount)}
                />
              </dl>

              <div className="mt-6 rounded-2xl bg-brand-50 px-5 py-4 text-sm leading-relaxed text-brand-900">
                <p className="font-medium">Renovación automática</p>
                <p className="mt-1">
                  {instagram.autoRefresh.enabled
                    ? `Activa. La tarea programada (${instagram.autoRefresh.cron}) revisa el token y lo renueva cuando le quedan ${instagram.autoRefresh.renewsWhenDaysLeft} días, así que no expira solo.`
                    : 'Desactivada: falta la variable CRON_SECRET en Vercel. Sin ella la tarea diaria responde 401 y el token dejará de renovarse; el feed se caería a los 60 días.'}
                </p>
              </div>

              {!instagram.connected && instagram.usable && (
                <p className="mt-4 rounded-2xl bg-brand-50 px-5 py-4 text-sm leading-relaxed text-brand-900">
                  Hay un token en las variables de entorno, así que no hace falta pasar por la
                  autorización: dale a <strong>Sincronizar publicaciones</strong> y el sistema lo
                  adopta y baja el feed. Conectar la cuenta solo hace falta si ese token falla o si
                  querés que se renueve solo con la cuenta real.
                </p>
              )}

              {instagram.lastError && (
                <p className="mt-4 flex items-start gap-2 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
                  <span>
                    <strong>Último error:</strong> {instagram.lastError}
                  </span>
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => connect('instagram')}
                  disabled={busy !== null}
                  className="btn-primary text-sm"
                >
                  {busy === 'instagram' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : instagram.connected ? (
                    'Reconectar cuenta'
                  ) : (
                    'Conectar cuenta'
                  )}
                </button>

                {instagram.usable && (
                  <>
                    <button
                      type="button"
                      onClick={refreshInstagramToken}
                      disabled={busy !== null}
                      className="btn-outline text-sm"
                    >
                      {busy === 'refresh' ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <RefreshCw className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                      )}
                      Renovar token ahora
                    </button>
                    <button
                      type="button"
                      onClick={syncFeed}
                      disabled={busy !== null}
                      className="btn-outline text-sm"
                    >
                      {busy === 'sync' ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : null}
                      Sincronizar publicaciones
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={() => void revisarInstagram()}
                  disabled={revisandoIg}
                  className="btn-outline text-sm"
                >
                  {revisandoIg ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  )}
                  Revisar la cuenta
                </button>
              </div>

              {errorDiagIg && (
                <p className="mt-4 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">
                  {errorDiagIg}
                </p>
              )}

              {diagIg && (
                <div className="mt-4 space-y-3 rounded-2xl border border-line bg-cream/50 p-5 text-sm">
                  {diagIg.error ? (
                    <p className="text-bad">
                      <strong>Meta responde con un error.</strong>{' '}
                      <span className="break-words">{diagIg.error}</span>
                    </p>
                  ) : diagIg.coincide === false ? (
                    <p className="text-bad">
                      <strong>Aquí está el problema: el token es de otra cuenta.</strong> Pertenece
                      a <code>@{diagIg.cuenta?.username}</code>, pero el sitio muestra el feed de{' '}
                      <code>@{diagIg.usernameEsperado}</code>. Hay que generar el token estando
                      dentro de la cuenta correcta, o conectar la cuenta desde aquí.
                    </p>
                  ) : diagIg.publicacionesEnMeta === 0 ? (
                    <p className="text-brand-900">
                      El token es correcto y es de <code>@{diagIg.cuenta?.username}</code>, pero esa
                      cuenta no tiene publicaciones que la API pueda leer. No hay nada que traer.
                    </p>
                  ) : (
                    <p className="text-brand-800">
                      <strong>Todo en orden.</strong> El token es de{' '}
                      <code>@{diagIg.cuenta?.username}</code> y Meta devuelve{' '}
                      {diagIg.publicacionesEnMeta} publicaciones. Si la portada sigue vacía, dale a
                      «Sincronizar publicaciones» y recarga.
                    </p>
                  )}

                  <dl className="grid gap-2 border-t border-line pt-3 text-xs text-muted sm:grid-cols-2">
                    <div>
                      <dt className="inline">Token: </dt>
                      <dd className="inline text-ink/80">
                        {diagIg.origenDelToken ?? 'no hay ninguno'}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Cuenta del token: </dt>
                      <dd className="inline text-ink/80">
                        {diagIg.cuenta ? `@${diagIg.cuenta.username}` : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Publicaciones en Meta: </dt>
                      <dd className="inline text-ink/80">{diagIg.publicacionesEnMeta ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="inline">Guardadas aquí: </dt>
                      <dd className="inline text-ink/80">{diagIg.publicacionesGuardadas}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </>
          )}
        </section>

        {/* Google Calendar */}
        <section className="rounded-2xl border border-line bg-surface p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <CalendarDays className="h-5 w-5" strokeWidth={1.8} aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-xl">Google Calendar</h2>
                <p className="text-sm text-muted">{googleCalendar.calendarId}</p>
              </div>
            </div>

            <StatusPill
              connected={googleCalendar.connected}
              configured={googleCalendar.configured}
            />
          </div>

          {!googleCalendar.configured ? (
            <p className="mt-6 rounded-2xl bg-warn-bg px-5 py-4 text-sm text-brand-900">
              Falta configurar <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> y{' '}
              <code>GOOGLE_REDIRECT_URI</code> en las variables de entorno (en producción, en Vercel).
            </p>
          ) : (
            <>
              <p className="mt-5 text-sm leading-relaxed text-muted">
                Cada reserva de la web crea un evento en este calendario, con recordatorios y con
                invitación al paciente si dejó su correo. Las citas que agendes a mano en Google
                también bloquean horarios en la web.
              </p>

              {googleCalendar.lastError && (
                <p className="mt-4 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">
                  <strong>Último error:</strong> {googleCalendar.lastError}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => connect('google')}
                  disabled={busy !== null}
                  className="btn-primary text-sm"
                >
                  {busy === 'google' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : googleCalendar.connected ? (
                    'Reconectar calendario'
                  ) : (
                    'Conectar calendario'
                  )}
                </button>

                {googleCalendar.connected && googleCalendar.lastError && (
                  <button
                    type="button"
                    onClick={() => void revisarCalendarios()}
                    disabled={revisando}
                    className="btn-outline text-sm"
                  >
                    {revisando ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <RefreshCw className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    )}
                    Revisar el calendario
                  </button>
                )}
              </div>

              {errorCalendarios && (
                <p className="mt-4 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">
                  {errorCalendarios}
                </p>
              )}

              {calendarios && (
                <div className="mt-4 rounded-2xl border border-line bg-cream/50 p-5">
                  {calendarios.accesible ? (
                    <p className="text-sm text-brand-800">
                      <strong>Todo en orden.</strong> La cuenta conectada puede escribir en el
                      calendario configurado.
                    </p>
                  ) : (
                    <p className="text-sm text-bad">
                      <strong>Aquí está el problema.</strong> La cuenta conectada no puede escribir
                      en <code className="break-all">{calendarios.calendarIdEnUso}</code>. Copia
                      abajo el identificador del calendario que sí quieras usar y ponlo en{' '}
                      <code>GOOGLE_CALENDAR_ID</code>, o comparte ese calendario con la cuenta
                      conectada y dale permiso para hacer cambios.
                    </p>
                  )}

                  <ul className="mt-4 space-y-2">
                    {calendarios.calendarios.map((calendario) => (
                      <li
                        key={calendario.id}
                        className="rounded-xl border border-line bg-surface px-4 py-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{calendario.nombre}</span>
                          {calendario.principal && (
                            <span className="rounded-full bg-line px-2 py-0.5 text-xs text-muted">
                              principal
                            </span>
                          )}
                          {calendario.enUso && (
                            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800">
                              en uso
                            </span>
                          )}
                          {!calendario.escribible && (
                            <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs text-warn">
                              solo lectura
                            </span>
                          )}
                        </div>
                        <p className="mt-1 break-all font-mono text-xs text-muted">
                          {calendario.id}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>

        {/* WhatsApp */}
        <section className="rounded-2xl border border-line bg-surface p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <MessageCircle className="h-5 w-5" strokeWidth={1.8} aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-xl">WhatsApp</h2>
                <p className="text-sm text-muted">{formatPhone(whatsapp.clinicNumber)}</p>
              </div>
            </div>

            <StatusPill connected={whatsapp.configured} configured />
          </div>

          <div className="mt-6 space-y-3 text-sm leading-relaxed">
            <p className="flex items-start gap-2 rounded-2xl bg-brand-50 px-5 py-4 text-brand-900">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
              <span>
                <strong>Enlaces wa.me: siempre activos.</strong> El botón flotante y los enlaces
                de contacto funcionan sin ninguna configuración.
              </span>
            </p>

            <p
              className={`flex items-start gap-2 rounded-2xl px-5 py-4 ${
                whatsapp.configured ? 'bg-brand-50 text-brand-900' : 'bg-warn-bg text-brand-900'
              }`}
            >
              {whatsapp.configured ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
              )}
              <span>
                <strong>Envíos automáticos: </strong>
                {whatsapp.configured
                  ? 'activos. Las confirmaciones de cita y los recordatorios del día anterior salen solos.'
                  : 'inactivos. Configura WHATSAPP_PHONE_NUMBER_ID y WHATSAPP_ACCESS_TOKEN para que las confirmaciones y recordatorios se envíen sin intervención.'}
              </span>
            </p>

            {whatsapp.configured && (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Metric
                  label="Plantilla de confirmación"
                  value={whatsapp.templates.confirmation ?? 'Texto libre'}
                />
                <Metric
                  label="Plantilla de recordatorio"
                  value={whatsapp.templates.reminder ?? 'Texto libre'}
                />
                {/* Sin plantilla, estos dos casi nunca salen: le escriben a
                    alguien que no ha hablado con el centro en 24 h. Quedan
                    pendientes en la Agenda para mandarlos a mano. */}
                <Metric
                  label="Plantilla de hueco liberado"
                  value={whatsapp.templates.hueco ?? 'Sin plantilla: se mandan a mano desde la Agenda'}
                />
                <Metric
                  label="Plantilla de día cerrado"
                  value={whatsapp.templates.diaCerrado ?? 'Sin plantilla: se mandan a mano desde la Agenda'}
                />
              </dl>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusPill({ connected, configured }: { connected: boolean; configured: boolean }) {
  if (!configured) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-line px-3 py-1 text-xs font-medium text-muted">
        <XCircle className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
        Sin configurar
      </span>
    );
  }

  return connected ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-medium text-brand-800">
      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
      Conectado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-bg px-3 py-1 text-xs font-medium text-warn">
      <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
      Falta conectar
    </span>
  );
}

function Metric({
  label,
  value,
  tone = 'ok',
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'danger' | 'off';
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-bad'
      : tone === 'warn'
        ? 'text-warn'
        : tone === 'off'
          ? 'text-muted'
          : 'text-brand-800';

  return (
    <div className="rounded-2xl bg-cream px-5 py-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-1 font-display text-lg ${toneClass}`}>{value}</dd>
    </div>
  );
}
