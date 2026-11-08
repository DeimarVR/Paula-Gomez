'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, RotateCw } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { CITA } from '@/lib/agenda';
import { hoyEnClinica, horaCorta } from '@/lib/format';
import type { DayAvailability, TimeSlot } from '@/lib/types';

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const VENTANA = 14;

function moverClave(clave: string, dias: number) {
  const f = new Date(`${clave}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

function claveDe(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function diaLargoDeClave(clave: string) {
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(`${clave}T12:00:00Z`),
  );
}

/**
 * Elegir día y hora, con los horarios libres de verdad.
 *
 * Lo usan la reserva, el cambio de hora desde el enlace de la cita y la
 * elección de hora tras un día cerrado. Se le pasa de dónde leer —la
 * disponibilidad pública o la de una cita concreta, que trae su propia hora
 * como libre— y devuelve el bloque elegido.
 *
 * Dos semanas a la vista, con flechas para avanzar. Los días sin nada libre
 * se ven apagados, con el motivo al pasar por encima: un domingo «sin
 * atención» no es lo mismo que un martes lleno.
 */
export function SelectorDeHorario({
  fuente,
  elegido,
  onElegir,
  inicial,
  maxDias = 60,
}: {
  /** '/api/public/availability' o '/api/public/bookings/<token>/horarios'. */
  fuente: string;
  /** El `startsAt` elegido, o null. */
  elegido: string | null;
  onElegir: (slot: TimeSlot, dia: string) => void;
  /** Un `startsAt` que hay que dejar elegido al abrir (viene de la portada). */
  inicial?: string;
  maxDias?: number;
}) {
  const hoy = hoyEnClinica();
  const [desde, setDesde] = useState(() => {
    if (!inicial) return hoy;
    const clave = claveDe(inicial);
    return clave > hoy ? clave : hoy;
  });
  const [dias, setDias] = useState<DayAvailability[] | null>(null);
  const [diaElegido, setDiaElegido] = useState<string | null>(inicial ? claveDe(inicial) : null);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [inicialUsado, setInicialUsado] = useState(!inicial);

  const cargar = useCallback(
    async (signal?: AbortSignal) => {
      setCargando(true);
      setFallo(false);
      try {
        const separador = fuente.includes('?') ? '&' : '?';
        const r = await api.get<{ days: DayAvailability[] }>(`${fuente}${separador}from=${desde}&days=${VENTANA}`, {
          signal,
          auth: false,
        });
        setDias(r.days);
        // Si no hay día elegido —o el elegido no está en esta tanda—, el primero con algo libre.
        setDiaElegido((actual) =>
          actual && r.days.some((d) => d.date === actual && d.availableCount > 0)
            ? actual
            : (r.days.find((d) => d.availableCount > 0)?.date ?? null),
        );
      } catch {
        if (!signal?.aborted) setFallo(true);
      } finally {
        if (!signal?.aborted) setCargando(false);
      }
    },
    [fuente, desde],
  );

  useEffect(() => {
    const control = new AbortController();
    void cargar(control.signal);
    return () => control.abort();
  }, [cargar]);

  const delDia = useMemo(() => (dias ?? []).find((d) => d.date === diaElegido) ?? null, [dias, diaElegido]);

  // La hora que venía de la portada se marca una sola vez, si sigue libre.
  useEffect(() => {
    if (inicialUsado || !delDia || !inicial) return;
    const slot = delDia.slots.find((s) => s.startsAt === inicial && s.available);
    if (slot) onElegir(slot, delDia.date);
    setInicialUsado(true);
  }, [delDia, inicial, inicialUsado, onElegir]);

  const limite = moverClave(hoy, maxDias);
  const puedeAtras = desde > hoy;
  const puedeAdelante = moverClave(desde, VENTANA) <= limite;
  const visibles = (delDia?.slots ?? []).filter((s) => s.available || s.motivo === 'ocupado' || s.motivo === 'suya');
  const libresEnTanda = (dias ?? []).reduce((n, d) => n + d.availableCount, 0);

  const mesDeLaTanda = (() => {
    if (!dias?.length) return '';
    const a = new Date(`${dias[0].date}T12:00:00Z`);
    const b = new Date(`${dias[dias.length - 1].date}T12:00:00Z`);
    return a.getUTCMonth() === b.getUTCMonth()
      ? `${MESES[a.getUTCMonth()]} ${a.getUTCFullYear()}`
      : `${MESES[a.getUTCMonth()]} – ${MESES[b.getUTCMonth()]} ${b.getUTCFullYear()}`;
  })();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[13.5px] font-semibold capitalize">{mesDeLaTanda || 'Fecha'}</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setDesde((d) => (moverClave(d, -VENTANA) < hoy ? hoy : moverClave(d, -VENTANA)))}
            disabled={!puedeAtras || cargando}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
            aria-label="Dos semanas antes"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setDesde((d) => moverClave(d, VENTANA))}
            disabled={!puedeAdelante || cargando}
            className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
            aria-label="Dos semanas después"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      {fallo ? (
        <div className="rounded-[10px] bg-bad-bg px-4 py-4 text-sm text-bad">
          <p>No pudimos consultar la agenda.</p>
          <button type="button" onClick={() => void cargar()} className="mt-2 inline-flex items-center gap-1.5 font-semibold underline">
            <RotateCw className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Reintentar
          </button>
        </div>
      ) : !dias ? (
        <p className="flex items-center gap-2 py-10 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Buscando horarios libres…
        </p>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-[7px]" role="group" aria-label="Días">
            {dias.map((dia) => {
              const fecha = new Date(`${dia.date}T12:00:00Z`);
              const libre = dia.availableCount > 0;
              const activo = dia.date === diaElegido;
              const motivo = dia.cerrado
                ? 'Ese día no habrá atención'
                : !dia.open
                  ? 'Sin atención'
                  : libre
                    ? `${dia.availableCount} horario${dia.availableCount === 1 ? '' : 's'} libre${dia.availableCount === 1 ? '' : 's'}`
                    : 'Sin horarios libres';
              return (
                <button
                  key={dia.date}
                  type="button"
                  disabled={!libre}
                  aria-pressed={activo}
                  aria-label={`${diaLargoDeClave(dia.date)}: ${motivo}`}
                  title={motivo}
                  onClick={() => setDiaElegido(dia.date)}
                  className={`grid min-h-[54px] justify-items-center gap-px rounded-[10px] border px-0.5 py-1.5 transition-[border-color,background-color] duration-200 ${
                    activo
                      ? 'border-brand-700 bg-brand-700 text-white shadow-[0_8px_16px_-10px_rgb(var(--brand-700)/0.8)]'
                      : libre
                        ? 'border-line bg-surface hover:border-line-strong'
                        : 'cursor-not-allowed border-transparent bg-cream text-subtle/60'
                  }`}
                >
                  <small className={`text-[11.5px] font-medium ${activo ? 'text-white/80' : 'text-subtle'}`}>
                    {DIAS_CORTOS[fecha.getUTCDay()]}
                  </small>
                  <b className="text-base font-semibold">{fecha.getUTCDate()}</b>
                </button>
              );
            })}
          </div>

          <div className="mt-5" aria-live="polite">
            {libresEnTanda === 0 ? (
              <p className="rounded-[10px] bg-cream px-4 py-4 text-sm text-muted">
                En estas dos semanas no quedan horarios libres. Pruebe con las siguientes.
              </p>
            ) : delDia ? (
              <>
                <p className="mb-2.5 text-[13.5px] font-semibold first-letter:uppercase">
                  {diaLargoDeClave(delDia.date)} · {CITA.duracionMin} min
                </p>
                <div className="grid grid-cols-3 gap-[7px] sm:grid-cols-4">
                  {visibles.map((slot) => (
                    <button
                      key={slot.startsAt}
                      type="button"
                      disabled={!slot.available}
                      aria-pressed={elegido === slot.startsAt}
                      aria-label={
                        slot.available
                          ? horaCorta(slot.startsAt)
                          : slot.motivo === 'suya'
                            ? `${horaCorta(slot.startsAt)}, su hora actual`
                            : `${horaCorta(slot.startsAt)}, ya tomado`
                      }
                      title={slot.motivo === 'suya' ? 'Su hora actual' : undefined}
                      onClick={() => onElegir(slot, delDia.date)}
                      className={`grid h-11 place-items-center whitespace-nowrap rounded-[9px] border text-sm font-semibold leading-tight transition-colors ${
                        elegido === slot.startsAt
                          ? 'border-brand-600 bg-brand-100 text-brand-700'
                          : slot.available
                            ? 'border-line bg-surface hover:border-line-strong'
                            : slot.motivo === 'suya'
                              ? 'cursor-default border-dashed border-brand-600/50 bg-brand-50 text-brand-700'
                              : 'cursor-not-allowed border-[#F3F4F6] bg-[#F3F4F6] text-[#A3ACB9] line-through'
                      }`}
                    >
                      <span>
                        {horaCorta(slot.startsAt)}
                        {slot.motivo === 'suya' && (
                          <small className="block text-[10.5px] font-medium text-brand-600">la suya</small>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
