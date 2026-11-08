'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  CalendarArrowDown as CalendarDown,
  CalendarClock,
  CalendarPlus,
  ExternalLink,
  Loader2,
  MessageCircle,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { buildWhatsAppLink, formatDateTime, formatPhone, hoyEnClinica } from '@/lib/format';
import { fechaEnPalabras, textoConfirmacionCita, whatsappEnPalabras } from '@/lib/mensajesCita';
import { SITE } from '@/lib/config';
import { ReagendarCita } from '@/components/admin/ReagendarCita';
import { NuevaCitaDialog } from '@/components/admin/NuevaCitaDialog';
import { TEXTO_ESTADO } from '@/components/admin/EstadoCita';
import { DiaDeAgenda } from '@/components/admin/agenda/DiaDeAgenda';
import { PendientesDeAgenda } from '@/components/admin/agenda/PendientesDeAgenda';
import type { AdminUser, AppointmentListItem, AppointmentStatus } from '@/lib/types';

/** Lo que responde /api/appointments/importar-calendario. */
interface ResumenImportacion {
  creadas: Array<{ paciente: string; cuando: string; tratamiento: string; avisos: string[] }>;
  yaEstaban: number;
  ignorados: number;
  noSeEntendieron: Array<{ titulo: string; motivo: string }>;
  errores: Array<{ titulo: string; motivo: string }>;
}

const STATUSES: AppointmentStatus[] = [
  'PENDIENTE',
  'CONFIRMADA',
  'COMPLETADA',
  'CANCELADA',
  'NO_ASISTIO',
];

const STATUS_STYLE: Record<AppointmentStatus, string> = {
  PENDIENTE: 'bg-warn-bg text-warn',
  CONFIRMADA: 'bg-ok-bg text-ok',
  COMPLETADA: 'bg-ok-bg text-muted',
  CANCELADA: 'bg-bad-bg text-bad',
  NO_ASISTIO: 'bg-bad-bg text-bad',
};

/**
 * El estado y las acciones, en un solo sitio.
 *
 * La pantalla tiene dos formas —tabla en el computador, tarjetas en el
 * teléfono— y estos dos trozos son idénticos en las dos. Sacarlos aquí es lo
 * que impide que dentro de un mes el botón de calendario exista solo en una.
 */
function SelectorEstado({
  cita,
  onCambiar,
}: {
  cita: AppointmentListItem;
  onCambiar: (id: string, estado: AppointmentStatus) => void;
}) {
  /**
   * Desde cuándo está en ese estado.
   *
   * El paciente puede confirmar o cancelar desde su enlace, y eso hoy no le
   * llega a nadie: el aviso sale por la Cloud API de WhatsApp, que todavía no
   * está activa. Sin esta línea, una confirmación se queda dentro de la base de
   * datos esperando a que alguien mire la lista y se acuerde de cómo estaba
   * antes. Con la hora al lado, «Confirmada · hace 2 h» se lee de un vistazo.
   */
  const cambiada = cita.status !== 'PENDIENTE' ? desdeCuando(cita.updatedAt) : null;

  return (
    <div className="flex flex-col gap-1">
      <select
        value={cita.status}
        onChange={(evento) => onCambiar(cita.id, evento.target.value as AppointmentStatus)}
        aria-label={`Estado de la cita de ${cita.contactName}`}
        className={`w-fit rounded-full border-0 px-3 py-1.5 text-xs font-semibold ${
          STATUS_STYLE[cita.status]
        }`}
      >
        {STATUSES.map((estado) => (
          <option key={estado} value={estado}>
            {estado === 'CANCELADA' && cita.needsReschedule ? 'Día cerrado' : TEXTO_ESTADO[estado]}
          </option>
        ))}
      </select>
      {cambiada && <span className="text-[0.7rem] text-subtle">{cambiada}</span>}
    </div>
  );
}

/** «hace 2 h», «hace 3 días». Vacío si hace demasiado como para importar. */
function desdeCuando(iso: string): string | null {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(minutos) || minutos < 0) return null;
  if (minutos < 1) return 'hace un momento';
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  return dias <= 30 ? `hace ${dias} ${dias === 1 ? 'día' : 'días'}` : null;
}

/**
 * La confirmación de una cita, lista para mandar por WhatsApp.
 *
 * Usa el mismo texto que enviaría el sistema solo: la plantilla vive en
 * `mensajesCita` justamente para que el mensaje sea idéntico salga por donde
 * salga, y corregir una frase no deje dos versiones circulando.
 */
function mensajeDeLaCita(cita: AppointmentListItem): string {
  return textoConfirmacionCita({
    centro: SITE.nombreEnMensajes,
    sede: SITE.addressFallback,
    // La zona es la de la clínica, no la del navegador: alguien revisando la
    // agenda desde otro país no puede hacer que el mensaje diga otra hora.
    cuando: fechaEnPalabras(cita.startsAt, 'America/Bogota'),
    whatsapp: whatsappEnPalabras(SITE.whatsappFallback),
  });
}

function AccionesCita({
  cita,
  sincronizando,
  onEnviarAlCalendario,
  onReagendar,
}: {
  cita: AppointmentListItem;
  sincronizando: string | null;
  onEnviarAlCalendario: (id: string) => void;
  onReagendar: (cita: AppointmentListItem) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      {/*
        La confirmación entera, no un «te escribimos sobre tu cita».
        Mientras el envío automático dependa de tener plantillas aprobadas y un
        número propio, este enlace ES el envío: se toca, WhatsApp abre con el
        mensaje completo escrito —tratamiento, fecha, dirección y el enlace para
        confirmar o cancelar— y solo queda darle a enviar. Escribir todo eso a
        mano, cita por cita, es lo que hace que al tercer día ya nadie lo mande.
      */}
      <a
        href={buildWhatsAppLink(cita.contactPhone, mensajeDeLaCita(cita))}
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir WhatsApp con la confirmación ya escrita"
        aria-label="Enviar la confirmación por WhatsApp"
        className="text-muted transition-colors hover:text-ok"
      >
        <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
      </a>
      {/*
        Reagendar desde aquí. El paciente tiene su enlace, pero lo normal es que
        escriba por WhatsApp pidiendo otro día; sin este botón la única salida
        era cancelar y crear otra cita, y eso rompe el enlace del paciente,
        pierde el evento del calendario y deja dos citas donde hubo una.
      */}
      <button
        type="button"
        onClick={() => onReagendar(cita)}
        title="Mover a otro día u hora"
        aria-label={`Reagendar la cita de ${cita.contactName}`}
        className="text-muted transition-colors hover:text-brand-700"
      >
        <CalendarClock className="h-4 w-4" strokeWidth={1.8} />
      </button>

      {cita.googleHtmlLink ? (
        <a
          href={cita.googleHtmlLink}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir en Google Calendar"
          className="text-muted transition-colors hover:text-brand-700"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
        </a>
      ) : (
        cita.status !== 'CANCELADA' && (
          <button
            type="button"
            onClick={() => onEnviarAlCalendario(cita.id)}
            disabled={sincronizando === cita.id}
            title="Esta cita no está en Google Calendar"
            aria-label={`Mandar al calendario la cita de ${cita.contactName}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-warn transition-colors hover:bg-warn-bg disabled:opacity-50"
          >
            {sincronizando === cita.id ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CalendarPlus className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            )}
            Sin calendario
          </button>
        )
      )}
    </div>
  );
}

function PacienteDeLaCita({ cita }: { cita: AppointmentListItem }) {
  return (
    <>
      <p className="font-semibold">{cita.contactName}</p>
      <p className="mt-0.5 text-xs text-subtle">{formatPhone(cita.contactPhone)}</p>
      {cita.patient && (
        <Link
          href={`/admin/pacientes/${cita.patient.id}`}
          className="mt-1 inline-block text-xs font-semibold text-brand-600 underline underline-offset-2"
        >
          Ver expediente
        </Link>
      )}
    </>
  );
}

export default function CitasPage() {
  /**
   * Dos formas de mirar la agenda.
   *
   * «Día» es la de trabajar: los bloques de un día con sus citas y sus huecos,
   * y el botón de cerrar el día. «Lista» es la de buscar: por nombre, por
   * estado, hacia atrás en el historial.
   */
  const [vista, setVista] = useState<'dia' | 'lista'>('dia');
  const [fecha, setFecha] = useState(hoyEnClinica());
  /** Sube cada vez que algo cambia, para que las dos vistas se recarguen. */
  const [version, setVersion] = useState(0);
  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  const [items, setItems] = useState<AppointmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');
  /**
   * Qué tramo de la lista se está mirando. Arranca en «Próximas» porque esta
   * pantalla se abre para trabajar, no para consultar el archivo.
   */
  const [periodo, setPeriodo] = useState<'proximas' | 'pasadas' | 'todas'>('proximas');
  /** Día y hora ya elegidos al abrir «Nueva cita» desde un bloque libre. */
  const [creando, setCreando] = useState<{
    fecha?: string;
    hora?: string;
    nombre?: string;
    nota?: string;
  } | null>(null);
  const [importando, setImportando] = useState(false);
  /** Lo que devolvió la última traída del calendario, para poder revisarlo. */
  const [resumen, setResumen] = useState<ResumenImportacion | null>(null);
  /** Null mientras no se sabe; luego, si la agenda de Google está conectada. */
  const [agendaConectada, setAgendaConectada] = useState<boolean | null>(null);
  const [usuario, setUsuario] = useState<AdminUser | null>(null);
  const [sincronizando, setSincronizando] = useState<string | null>(null);
  /** La cita que se está moviendo de día. */
  const [reagendando, setReagendando] = useState<AppointmentListItem | null>(null);

  const esAdmin = usuario?.role === 'ADMIN';
  // Cerrar el día lo decide la especialista, pero lo pulsa también recepción.
  const puedeCerrar = usuario?.role === 'ADMIN' || usuario?.role === 'RECEPCION';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ take: '100' });
      if (query) params.set('q', query);
      if (statusFilter) params.set('status', statusFilter);
      params.set('periodo', periodo);

      const data = await api.get<{ items: AppointmentListItem[] }>(
        `/api/appointments?${params.toString()}`,
      );
      setItems(data.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar las citas');
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, periodo]);

  useEffect(() => {
    if (vista !== 'lista') return undefined;
    // Espera a que el usuario deje de escribir antes de consultar.
    const timer = setTimeout(() => void load(), query ? 400 : 0);
    return () => clearTimeout(timer);
  }, [load, query, vista, version]);

  useEffect(() => {
    /**
     * Sin esto, una cita sin evento parece un fallo suelto. Casi siempre es lo
     * mismo para todas: la agenda no está conectada.
     */
    void api
      .get<{ googleCalendar: { connected: boolean } }>('/api/integrations/status')
      .then((datos) => setAgendaConectada(datos.googleCalendar.connected))
      .catch(() => setAgendaConectada(null));

    void api
      .get<{ user: AdminUser }>('/api/auth/me')
      .then((datos) => setUsuario(datos.user))
      .catch(() => setUsuario(null));

    /*
     * Llegadas desde fuera: «Nueva cita» de la barra superior (?nueva=1) y el
     * asistente, que además manda lo que entendió (?fecha=&hora=&paciente=).
     * Con solo ?fecha= se abre ese día en la agenda.
     */
    const params = new URLSearchParams(window.location.search);
    const fechaPedida = params.get('fecha');
    const valida = fechaPedida && /^\d{4}-\d{2}-\d{2}$/.test(fechaPedida) ? fechaPedida : undefined;
    if (valida) setFecha(valida);
    if (params.get('nueva') === '1') {
      setCreando({
        fecha: valida,
        hora: params.get('hora') ?? undefined,
        nombre: params.get('paciente') ?? undefined,
        nota: params.get('motivo') ?? undefined,
      });
    }
    if (params.toString()) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    }
  }, []);

  async function enviarAlCalendario(id: string) {
    setSincronizando(id);
    setError(null);
    try {
      await api.post(`/api/appointments/${id}/calendario`, {});
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No pudimos mandar la cita al calendario',
      );
    } finally {
      setSincronizando(null);
    }
  }

  async function changeStatus(id: string, status: AppointmentStatus) {
    setError(null);
    // Actualización optimista: la lista responde de inmediato.
    setItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
    try {
      await api.patch(`/api/appointments/${id}/status`, { status });
    } catch (caught) {
      // Devolver una cancelada a «pendiente» no se puede: el servidor lo dice.
      setError(caught instanceof Error ? caught.message : 'No pudimos cambiar el estado');
      void load();
    } finally {
      recargar();
    }
  }

  async function importar() {
    setImportando(true);
    try {
      const datos = await api.post<ResumenImportacion>('/api/appointments/importar-calendario');
      setResumen(datos);
      if (datos.creadas.length > 0) recargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos traer las citas del calendario');
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-[76rem] gap-6">
      <div className="page-head">
        <div>
          <h1>Agenda</h1>
          <p>Una cita a la vez, en bloques de 75 minutos.</p>
        </div>
        <div className="page-actions">
          {/*
            El puente con la libreta de Google. En el mostrador la señal se
            cae, y la app de Calendar del celular sí guarda sin internet; esto
            recoge lo que se anotó allá.
          */}
          <button
            type="button"
            onClick={() => void importar()}
            disabled={importando}
            title="Trae las citas que se anotaron en Google Calendar sin conexión"
            className="btn-outline btn-sm"
          >
            {importando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CalendarDown className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            )}
            Traer del calendario
          </button>
          <button type="button" onClick={() => setCreando({})} className="btn-primary btn-sm">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Nueva cita
          </button>
        </div>
      </div>

      {/*
        El resultado se queda en pantalla hasta que la persona lo cierra: si
        una cita entró sin teléfono, hay que ir a arreglarla, y un aviso que se
        desvanece solo no deja hacerlo.
      */}
      {resumen && (
        <div className="card px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-semibold">
              {resumen.creadas.length === 0
                ? 'No había citas nuevas en el calendario.'
                : `Se trajeron ${resumen.creadas.length} ${
                    resumen.creadas.length === 1 ? 'cita' : 'citas'
                  } del calendario.`}
              {resumen.yaEstaban > 0 && (
                <span className="font-normal text-muted"> {resumen.yaEstaban} ya estaban.</span>
              )}
            </p>
            <button
              type="button"
              onClick={() => setResumen(null)}
              aria-label="Cerrar el resumen"
              className="shrink-0 text-muted hover:text-ink"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {resumen.creadas.some((c) => c.avisos.length > 0) && (
            <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs text-warn">
              {resumen.creadas
                .filter((c) => c.avisos.length > 0)
                .map((c, i) => (
                  <li key={`aviso-${i}`}>
                    <strong>{c.paciente}</strong>: {c.avisos.join('. ')}
                  </li>
                ))}
            </ul>
          )}

          {resumen.noSeEntendieron.length > 0 && (
            <div className="mt-3 border-t border-line pt-3">
              <p className="text-xs font-semibold text-bad">Estos eventos no se pudieron traer:</p>
              <ul className="mt-1.5 space-y-1 text-xs text-bad">
                {resumen.noSeEntendieron.map((n, i) => (
                  <li key={`nada-${i}`}>
                    «{n.titulo}» — {n.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {agendaConectada === false && (
        <p className="rounded-[10px] bg-warn-bg px-5 py-4 text-sm text-warn">
          <strong className="font-semibold">Las citas no se están enviando a Google Calendar.</strong>{' '}
          Se guardan aquí, pero no aparecen en el calendario del centro.{' '}
          {esAdmin ? (
            <Link href="/admin/integraciones" className="underline underline-offset-2">
              Conectarla en Integraciones
            </Link>
          ) : (
            'Pídele a un administrador que la conecte en Integraciones.'
          )}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-[10px] bg-bad-bg px-5 py-4 text-sm text-bad">
          {error}
        </p>
      )}

      <div className="tabs" role="tablist" aria-label="Vista de la agenda">
        {(
          [
            ['dia', 'Por día'],
            ['lista', 'Lista y búsqueda'],
          ] as const
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={vista === valor}
            onClick={() => setVista(valor)}
            className="tab"
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {vista === 'dia' ? (
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <DiaDeAgenda
            fecha={fecha}
            onCambiarFecha={setFecha}
            version={version}
            puedeCerrar={puedeCerrar}
            onNuevaCita={(dia, hora) => setCreando({ fecha: dia, hora })}
            onReagendar={setReagendando}
            onCambiarEstado={changeStatus}
            onCambio={recargar}
          />
          <PendientesDeAgenda version={version} puedeReabrir={puedeCerrar} onCambio={recargar} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[16rem] flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle"
                strokeWidth={1.8}
                aria-hidden
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, cédula, teléfono o correo"
                aria-label="Buscar citas"
                className="field pl-10"
              />
            </div>

            <div className="flex rounded-[10px] border border-line bg-surface p-1">
              {(
                [
                  ['proximas', 'Próximas'],
                  ['pasadas', 'Pasadas'],
                  ['todas', 'Todas'],
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setPeriodo(valor)}
                  aria-pressed={periodo === valor}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                    periodo === valor ? 'bg-brand-700 text-white' : 'text-muted hover:bg-brand-50'
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AppointmentStatus | '')}
              aria-label="Filtrar por estado"
              className="field w-auto"
            >
              <option value="">Todos los estados</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TEXTO_ESTADO[status]}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center gap-3 py-20 text-muted">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Cargando citas…
            </div>
          ) : items.length === 0 ? (
            <p className="card px-6 py-16 text-center text-sm text-muted">
              No hay citas que coincidan con la búsqueda.
            </p>
          ) : (
            <>
              {/*
                Una tabla de cuatro columnas no cabe en un teléfono: debajo de
                `sm` cada cita es una tarjeta; de ahí para arriba, la tabla.
              */}
              <ul className="space-y-3 sm:hidden">
                {items.map((appointment) => (
                  <li key={appointment.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <PacienteDeLaCita cita={appointment} />
                      </div>
                      <SelectorEstado cita={appointment} onCambiar={changeStatus} />
                    </div>
                    <p className="mt-3 text-sm text-muted">{formatDateTime(appointment.startsAt)}</p>
                    <div className="mt-3 border-t border-line pt-3">
                      <AccionesCita
                        cita={appointment}
                        sincronizando={sincronizando}
                        onEnviarAlCalendario={(id) => void enviarAlCalendario(id)}
                        onReagendar={setReagendando}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <div className="panel-card hidden overflow-x-auto sm:block">
                <table className="tabla min-w-[44rem]">
                  <thead>
                    <tr>
                      <th scope="col">Fecha</th>
                      <th scope="col">Paciente</th>
                      <th scope="col">Estado</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((appointment) => (
                      <tr key={appointment.id}>
                        <td className="hora">{formatDateTime(appointment.startsAt)}</td>
                        <td>
                          <PacienteDeLaCita cita={appointment} />
                        </td>
                        <td>
                          <SelectorEstado cita={appointment} onCambiar={changeStatus} />
                        </td>
                        <td>
                          <div className="flex justify-end">
                            <AccionesCita
                              cita={appointment}
                              sincronizando={sincronizando}
                              onEnviarAlCalendario={(id) => void enviarAlCalendario(id)}
                              onReagendar={setReagendando}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {reagendando && (
        <ReagendarCita
          cita={reagendando}
          onCerrar={() => setReagendando(null)}
          onHecho={() => {
            setReagendando(null);
            recargar();
          }}
        />
      )}

      {creando && (
        <NuevaCitaDialog
          fechaInicial={creando.fecha}
          horaInicial={creando.hora}
          nombreInicial={creando.nombre}
          notaInicial={creando.nota}
          onCerrar={() => setCreando(null)}
          onCreada={() => {
            setCreando(null);
            recargar();
          }}
        />
      )}
    </div>
  );
}
