'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  CalendarX,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MessageCircle,
  Plus,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { CITA } from '@/lib/agenda';
import { buildWhatsAppLink, diaDeClave, formatPhone, hoyEnClinica, horaCorta, iniciales } from '@/lib/format';
import { EstadoCita } from '@/components/admin/EstadoCita';
import { CerrarDiaDialog } from '@/components/admin/agenda/CerrarDiaDialog';
import type { AppointmentListItem, AppointmentStatus } from '@/lib/types';

interface Bloque {
  time: string;
  startsAt: string;
  endsAt: string;
  available: boolean;
  motivo?: 'ocupado' | 'bloqueado' | 'muy-pronto' | 'muy-lejos';
}

interface Dia {
  date: string;
  open: boolean;
  cerrado: { motivo: string | null } | null;
  slots: Bloque[];
}

const ACTIVAS: AppointmentStatus[] = ['PENDIENTE', 'CONFIRMADA'];

/** «2026-11-17» ± días, sin pasar por la zona del navegador. */
function moverClave(clave: string, dias: number): string {
  const fecha = new Date(`${clave}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

type Fila =
  | { tipo: 'cita'; inicio: string; cita: AppointmentListItem }
  | { tipo: 'bloque'; inicio: string; bloque: Bloque };

/**
 * La agenda de un día, en bloques de una cita.
 *
 * Cada bloque de 75 minutos sale como una fila: con la cita que lo ocupa, o
 * libre con su botón para agendar ahí mismo. Es como se mira una agenda de
 * papel: de arriba abajo, con los huecos a la vista.
 *
 * Una cita puesta desde el mostrador a una hora que no es comienzo de bloque
 * —las 8:30— sale en su sitio, y los bloques que pisa dejan de ofrecerse.
 */
export function DiaDeAgenda({
  fecha,
  onCambiarFecha,
  version,
  puedeCerrar,
  onNuevaCita,
  onReagendar,
  onCambiarEstado,
  onCambio,
}: {
  fecha: string;
  onCambiarFecha: (fecha: string) => void;
  /** Sube cuando algo cambió fuera (una cita nueva, un reagendamiento). */
  version: number;
  puedeCerrar: boolean;
  onNuevaCita: (fecha: string, hora: string) => void;
  onReagendar: (cita: AppointmentListItem) => void;
  onCambiarEstado: (id: string, estado: AppointmentStatus) => Promise<void>;
  /** Algo cambió aquí dentro: un cierre, una reapertura. */
  onCambio: () => void;
}) {
  const [dia, setDia] = useState<Dia | null>(null);
  const [citas, setCitas] = useState<AppointmentListItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [reabriendo, setReabriendo] = useState(false);

  const cargar = useCallback(
    async (signal?: AbortSignal) => {
      setCargando(true);
      setError(null);
      try {
        const [disponibilidad, lista] = await Promise.all([
          api.get<{ days: Dia[] }>(`/api/availability?from=${fecha}&days=1`, { signal }),
          api.get<{ items: AppointmentListItem[] }>(`/api/appointments?dia=${fecha}&take=100`, { signal }),
        ]);
        setDia(disponibilidad.days[0] ?? null);
        setCitas(lista.items);
      } catch (caught) {
        if (signal?.aborted) return;
        setError(caught instanceof Error ? caught.message : 'No pudimos cargar el día');
      } finally {
        if (!signal?.aborted) setCargando(false);
      }
    },
    [fecha],
  );

  useEffect(() => {
    const control = new AbortController();
    void cargar(control.signal);
    return () => control.abort();
  }, [cargar, version]);

  async function reabrir() {
    setReabriendo(true);
    setError(null);
    try {
      await api.delete(`/api/cierres/${fecha}`);
      await cargar();
      onCambio();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos reabrir el día');
    } finally {
      setReabriendo(false);
    }
  }

  async function cambiarEstado(id: string, estado: AppointmentStatus) {
    try {
      await onCambiarEstado(id, estado);
    } finally {
      await cargar();
    }
  }

  const hoy = hoyEnClinica();
  const pasado = fecha < hoy;
  const activas = citas.filter((c) => ACTIVAS.includes(c.status));
  const otras = citas.filter((c) => !ACTIVAS.includes(c.status) && c.status !== 'COMPLETADA' && c.status !== 'NO_ASISTIO');
  const atendidas = citas.filter((c) => c.status === 'COMPLETADA' || c.status === 'NO_ASISTIO');
  const porVenir = activas.filter((c) => new Date(c.startsAt) > new Date()).length;

  /*
   * Las filas: las citas vivas y atendidas, más los bloques que ninguna pisa.
   * Un bloque libre que ya pasó no se muestra: no se va a usar.
   */
  const ocupan = [...activas, ...atendidas];
  const pisa = (b: Bloque) =>
    ocupan.some((c) => new Date(c.startsAt) < new Date(b.endsAt) && new Date(c.endsAt) > new Date(b.startsAt));
  const filas: Fila[] = [
    ...ocupan.map((cita) => ({ tipo: 'cita' as const, inicio: cita.startsAt, cita })),
    ...(dia?.slots ?? [])
      .filter((b) => !pisa(b) && b.motivo !== 'muy-pronto')
      .map((bloque) => ({ tipo: 'bloque' as const, inicio: bloque.startsAt, bloque })),
  ].sort((a, b) => a.inicio.localeCompare(b.inicio));

  return (
    <section className="panel-card" aria-labelledby="dia-titulo">
      <div className="card-head flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onCambiarFecha(moverClave(fecha, -1))}
            className="icon-btn h-9 w-9"
            aria-label="Día anterior"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <div className="min-w-0 px-1">
            <h2 id="dia-titulo" className="first-letter:uppercase">
              {diaDeClave(fecha)}
            </h2>
            <p>
              {fecha === hoy ? 'Hoy · ' : ''}
              {dia?.cerrado
                ? 'Cerrado'
                : !dia?.open
                  ? 'Sin atención'
                  : `${activas.length} cita${activas.length === 1 ? '' : 's'} · ${(dia?.slots ?? []).filter((b) => b.available).length} libres`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCambiarFecha(moverClave(fecha, 1))}
            className="icon-btn h-9 w-9"
            aria-label="Día siguiente"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="agenda-fecha">
            Ir a una fecha
          </label>
          <input
            id="agenda-fecha"
            type="date"
            value={fecha}
            onChange={(e) => e.target.value && onCambiarFecha(e.target.value)}
            className="field min-h-10 w-auto py-1.5 text-sm"
          />
          {fecha !== hoy && (
            <button type="button" onClick={() => onCambiarFecha(hoy)} className="btn-outline btn-sm">
              Hoy
            </button>
          )}
          {puedeCerrar && !pasado && dia?.open && !dia.cerrado && (
            <button
              type="button"
              onClick={() => setCerrando(true)}
              className="btn btn-sm border-bad/40 bg-surface text-bad hover:bg-bad-bg"
            >
              <CalendarX className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              Cerrar este día
            </button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="mx-[22px] mt-4 flex items-start gap-2 rounded-[10px] bg-bad-bg px-4 py-3 text-sm text-bad">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
          {error}
        </p>
      )}

      {cargando && !dia ? (
        <p className="flex items-center gap-3 px-[22px] py-14 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Cargando el día…
        </p>
      ) : dia?.cerrado ? (
        <div className="px-[22px] py-6">
          <div className="flex flex-wrap items-center gap-4 rounded-xl bg-warn-bg px-5 py-4 text-warn">
            <CalendarX className="h-6 w-6 shrink-0" strokeWidth={1.8} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Este día está cerrado</p>
              <p className="text-sm">
                {dia.cerrado.motivo ? `Motivo: ${dia.cerrado.motivo}. ` : ''}No acepta citas ni de la web
                ni del panel.
              </p>
            </div>
            {puedeCerrar && (
              <button
                type="button"
                onClick={() => void reabrir()}
                disabled={reabriendo}
                className="btn-outline btn-sm"
              >
                {reabriendo ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <RotateCcw className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                )}
                Reabrir el día
              </button>
            )}
          </div>
          {otras.some((c) => c.needsReschedule) && (
            <>
              <p className="mt-5 text-sm font-semibold">Citas que se cancelaron al cerrar</p>
              <p className="text-[13px] text-subtle">
                Recibieron una disculpa con un enlace para elegir otra hora. Reabrir el día no las
                devuelve.
              </p>
              <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
                {otras
                  .filter((c) => c.needsReschedule)
                  .map((cita) => (
                    <li key={cita.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <span className="w-[68px] text-sm font-semibold tabular-nums">{horaCorta(cita.startsAt)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{cita.contactName}</span>
                      <EstadoCita estado={cita.status} porReagendar />
                      <button type="button" onClick={() => onReagendar(cita)} className="btn-text">
                        Reagendar
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      ) : !dia?.open ? (
        <p className="px-[22px] py-12 text-center text-sm text-muted">
          Este día de la semana no hay atención. El horario se cambia en «Horario».
        </p>
      ) : filas.length === 0 ? (
        <p className="px-[22px] py-12 text-center text-sm text-muted">
          {pasado ? 'Ese día no hubo citas.' : 'Ya no quedan bloques por hoy.'}
        </p>
      ) : (
        <ol className="divide-y divide-line">
          {filas.map((fila) =>
            fila.tipo === 'cita' ? (
              <FilaCita
                key={fila.cita.id}
                cita={fila.cita}
                onReagendar={onReagendar}
                onCambiarEstado={(estado) => void cambiarEstado(fila.cita.id, estado)}
              />
            ) : (
              <li key={fila.bloque.startsAt} className="flex items-center gap-4 px-[22px] py-3">
                <span className="w-[92px] flex-none text-sm font-semibold tabular-nums text-subtle">
                  {horaCorta(fila.bloque.startsAt)}
                </span>
                {fila.bloque.available ? (
                  <>
                    <span className="min-w-0 flex-1 text-sm text-muted">Libre · {CITA.duracionMin} min</span>
                    <button
                      type="button"
                      onClick={() => onNuevaCita(fecha, fila.bloque.time)}
                      className="btn-text"
                    >
                      <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Agendar aquí
                    </button>
                  </>
                ) : (
                  <span className="min-w-0 flex-1 text-sm text-subtle">
                    {fila.bloque.motivo === 'bloqueado'
                      ? 'Ocupado en la agenda de Google de la especialista'
                      : 'No disponible'}
                  </span>
                )}
              </li>
            ),
          )}
        </ol>
      )}

      {otras.filter((c) => !c.needsReschedule).length > 0 && !dia?.cerrado && (
        <div className="card-foot">
          <p className="text-[13px] font-semibold text-subtle">Canceladas este día</p>
          <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-subtle">
            {otras
              .filter((c) => !c.needsReschedule)
              .map((c) => (
                <li key={c.id}>
                  {horaCorta(c.startsAt)} · {c.contactName}
                </li>
              ))}
          </ul>
        </div>
      )}

      {cerrando && (
        <CerrarDiaDialog
          fecha={fecha}
          citasDelDia={porVenir}
          onCerrar={() => setCerrando(false)}
          onHecho={() => {
            void cargar();
            onCambio();
          }}
        />
      )}
    </section>
  );
}

/** Una cita en la agenda del día: quién, cómo va y qué se puede hacer. */
function FilaCita({
  cita,
  onReagendar,
  onCambiarEstado,
}: {
  cita: AppointmentListItem;
  onReagendar: (cita: AppointmentListItem) => void;
  onCambiarEstado: (estado: AppointmentStatus) => void;
}) {
  const viva = cita.status === 'PENDIENTE' || cita.status === 'CONFIRMADA';
  const empezo = new Date(cita.startsAt) <= new Date();

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-[22px] py-3.5">
      <span className="w-[92px] flex-none text-sm font-semibold tabular-nums">{horaCorta(cita.startsAt)}</span>
      <div className="persona min-w-[12rem] flex-1">
        <span className="avatar" aria-hidden>
          {iniciales(cita.contactName)}
        </span>
        <div className="min-w-0">
          <b className="truncate">{cita.contactName}</b>
          <span className="meta">{formatPhone(cita.contactPhone)}</span>
        </div>
      </div>
      <EstadoCita estado={cita.status} />
      <div className="flex flex-wrap items-center gap-1">
        {viva && empezo && (
          <>
            <button type="button" onClick={() => onCambiarEstado('COMPLETADA')} className="btn-text">
              Atendida
            </button>
            <button type="button" onClick={() => onCambiarEstado('NO_ASISTIO')} className="btn-text text-bad hover:bg-bad-bg">
              No vino
            </button>
          </>
        )}
        {viva && !empezo && (
          <>
            {cita.status === 'PENDIENTE' && (
              <a
                href={buildWhatsAppLink(cita.contactPhone)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-text"
                title="Escribirle por WhatsApp"
              >
                <MessageCircle className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                Escribir
              </a>
            )}
            <button type="button" onClick={() => onReagendar(cita)} className="btn-text">
              <CalendarClock className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              Mover
            </button>
          </>
        )}
        {cita.patient && (
          <Link href={`/admin/pacientes/${cita.patient.id}`} className="btn-text">
            Expediente
          </Link>
        )}
      </div>
    </li>
  );
}
