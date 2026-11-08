'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarX2, Clock, Loader2, RotateCw } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { CITA } from '@/lib/agenda';

/**
 * La hora de la cita, elegida de la agenda real.
 *
 * Se ofrecen los bloques de la consulta —75 minutos, seguidos desde la
 * apertura— que existen ese día. Los ocupados aparecen tachados y no se dejan
 * tocar: se ven, para poder decir «a las 9:15 está tomada, ¿a las 10:30?», que
 * es la conversación que se tiene en el mostrador. Es la misma grilla de la
 * reserva pública y la de reagendar, con los mismos datos.
 */

export interface Hueco {
  /** "09:15" en hora local de la clínica. */
  time: string;
  startsAt: string;
  available: boolean;
  motivo?: 'ocupado' | 'bloqueado' | 'muy-pronto' | 'muy-lejos';
}

const MOTIVO: Record<string, string> = {
  ocupado: 'Ya hay una cita a esa hora',
  bloqueado: 'La especialista tiene otro compromiso a esa hora',
  'muy-pronto': 'Ya pasó',
  'muy-lejos': 'Demasiado lejos',
};

/** "18:30" -> "6:30 pm", igual que `horaCorta` en el resto del sitio. */
export function horaEnPalabras(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

interface Props {
  /** "2026-09-11" */
  fecha: string;
  /** Hora elegida, "09:15". */
  valor: string;
  /**
   * `hora` para los formularios que mandan fecha y hora por separado;
   * `startsAt` para los que mandan el instante ya resuelto, como reagendar.
   * Va el instante que calculó el servidor, no uno armado en el navegador:
   * hacerlo aquí usaría la zona horaria del portátil.
   */
  onElegir: (hora: string, startsAt: string) => void;
  /** La cita que se está moviendo: su propia hora sale libre. */
  excluirCitaId?: string;
  /** Para marcar en rojo desde el formulario. */
  invalido?: boolean;
  /** Se anuncia junto al primer botón, que es donde llega el foco al validar. */
  id?: string;
}

interface Dia {
  date: string;
  open: boolean;
  cerrado: { motivo: string | null } | null;
  slots: Hueco[];
}

export function SelectorHueco({ fecha, valor, onElegir, excluirCitaId, invalido, id }: Props) {
  const [dia, setDia] = useState<Dia | null>(null);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState(false);

  const cargar = useCallback(
    (signal?: AbortSignal) => {
      if (!fecha) {
        setDia(null);
        return;
      }

      setCargando(true);
      setFallo(false);

      const excluir = excluirCitaId ? `&excluir=${encodeURIComponent(excluirCitaId)}` : '';
      void api
        .get<{ days: Dia[] }>(`/api/availability?from=${fecha}&days=1${excluir}`, { signal })
        .then((datos) => setDia(datos?.days?.[0] ?? null))
        .catch((caught) => {
          // Abortar al cambiar de fecha no es un fallo: es la petición vieja.
          if (signal?.aborted || (caught as Error)?.name === 'AbortError') return;
          setDia(null);
          setFallo(true);
        })
        .finally(() => {
          if (!signal?.aborted) setCargando(false);
        });
    },
    [fecha, excluirCitaId],
  );

  useEffect(() => {
    const control = new AbortController();
    cargar(control.signal);
    return () => control.abort();
  }, [cargar]);

  if (cargando && !dia) {
    return (
      <p className="flex items-center gap-2 px-1 py-5 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Buscando horarios…
      </p>
    );
  }

  if (fallo) {
    return (
      <div className="rounded-[10px] bg-bad-bg px-4 py-4 text-sm text-bad">
        <p>No pudimos consultar la agenda.</p>
        <button
          type="button"
          onClick={() => cargar()}
          className="mt-2 inline-flex items-center gap-1.5 font-semibold underline underline-offset-2"
        >
          <RotateCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Reintentar
        </button>
      </div>
    );
  }

  /*
   * Se muestran los libres y los tomados. Lo que ya pasó se esconde: una
   * casilla muerta que nunca se va a poder tocar solo alarga la lista.
   */
  const visibles = (dia?.slots ?? []).filter(
    (h) => h.available || h.motivo === 'ocupado' || h.motivo === 'bloqueado',
  );
  const libres = visibles.filter((h) => h.available);

  if (!dia || !dia.open || dia.cerrado || visibles.length === 0) {
    return (
      <div
        className={`rounded-[10px] border border-dashed px-4 py-6 text-center ${
          invalido ? 'border-bad/40 bg-bad-bg/40' : 'border-line-strong/60'
        }`}
      >
        <CalendarX2 className="mx-auto h-6 w-6 text-brand-300" strokeWidth={1.5} aria-hidden />
        <p className="mt-2 text-sm text-muted">
          {dia?.cerrado
            ? `Ese día está cerrado${dia.cerrado.motivo ? ` (${dia.cerrado.motivo})` : ''}. Prueba con otra fecha.`
            : !dia?.open
              ? 'Ese día el centro no atiende. Prueba con otra fecha.'
              : 'Ese día ya no queda ningún horario libre. Prueba con otra fecha.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2.5 flex items-center gap-2 text-xs text-muted">
        <Clock className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
        {libres.length === 0
          ? 'No queda ningún horario libre ese día'
          : `${libres.length} ${libres.length === 1 ? 'horario libre' : 'horarios libres'} · ${CITA.duracionMin} min cada uno`}
      </p>

      <div
        className={`grid grid-cols-3 gap-2 sm:grid-cols-4 ${
          invalido ? 'rounded-[10px] p-2 ring-1 ring-bad/40' : ''
        }`}
      >
        {visibles.map((hueco, indice) => (
          <button
            key={hueco.startsAt}
            id={indice === 0 ? id : undefined}
            type="button"
            disabled={!hueco.available}
            onClick={() => onElegir(hueco.time, hueco.startsAt)}
            aria-pressed={valor === hueco.time}
            title={hueco.available ? undefined : (MOTIVO[hueco.motivo ?? ''] ?? 'No disponible')}
            aria-label={
              hueco.available
                ? horaEnPalabras(hueco.time)
                : `${horaEnPalabras(hueco.time)}, ${MOTIVO[hueco.motivo ?? '']?.toLowerCase() ?? 'no disponible'}`
            }
            className={`min-h-11 rounded-lg border px-1 py-1 text-sm font-semibold tabular-nums leading-tight transition-colors ${
              valor === hueco.time
                ? 'border-brand-700 bg-brand-700 text-white'
                : hueco.available
                  ? 'border-line-strong/60 bg-surface hover:border-brand-600 hover:bg-brand-50'
                  : 'cursor-not-allowed border-line bg-cream text-subtle/70 line-through'
            }`}
          >
            {horaEnPalabras(hueco.time)}
          </button>
        ))}
      </div>

      {visibles.length > libres.length && (
        <p className="mt-2.5 text-xs leading-relaxed text-muted">
          Los tachados ya están tomados. Una persona a la vez: dos citas no se pueden pisar.
        </p>
      )}
    </div>
  );
}
