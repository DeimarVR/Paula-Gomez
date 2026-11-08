'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Check, Info, Loader2, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { CITA, aHora, bloquesDelDia, sobranteDelDia } from '@/lib/agenda';
import { formatDateTime } from '@/lib/format';
import { horaEnPalabras } from '@/components/admin/SelectorHueco';

interface DiaDelHorario {
  dia: number;
  activo: boolean;
  apertura: string;
  cierre: string;
  pausaInicio: string | null;
  pausaFin: string | null;
}

interface Respuesta {
  duracionMin: number;
  dias: Array<DiaDelHorario & { bloques: string[] }>;
  citasFuera?: Array<{ id: string; nombre: string; startsAt: string }>;
}

const NOMBRES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/** La semana empieza el lunes, como en cualquier agenda de consultorio. */
const ORDEN = [1, 2, 3, 4, 5, 6, 0];

/**
 * El horario de atención, editable.
 *
 * Con citas de 75 minutos seguidas desde la apertura, cada cambio de horario
 * mueve la agenda entera. Por eso cada día enseña, mientras se escribe, qué
 * bloques salen y cuántos minutos sobran al final de cada tramo: que la tarde
 * de 14:00 a 18:00 deja 15 minutos muertos se ve antes de guardar, no después.
 *
 * Guardar no mueve ni cancela citas. Si alguna queda por fuera del horario
 * nuevo, se avisa con su nombre para llamar a esa persona.
 */
export default function HorarioPage() {
  const [dias, setDias] = useState<DiaDelHorario[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [citasFuera, setCitasFuera] = useState<Respuesta['citasFuera']>([]);

  useEffect(() => {
    void api
      .get<Respuesta>('/api/horario')
      .then((r) => setDias(r.dias.map(({ bloques: _b, ...d }) => d)))
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'No pudimos cargar el horario'));
  }, []);

  function cambiar(dia: number, cambio: Partial<DiaDelHorario>) {
    setGuardado(false);
    setDias((actual) => actual?.map((d) => (d.dia === dia ? { ...d, ...cambio } : d)) ?? null);
  }

  async function guardar() {
    if (!dias) return;
    setGuardando(true);
    setError(null);
    setGuardado(false);
    try {
      const r = await api.put<Respuesta>('/api/horario', { dias });
      setDias(r.dias.map(({ bloques: _b, ...d }) => d));
      setCitasFuera(r.citasFuera ?? []);
      setGuardado(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos guardar el horario');
    } finally {
      setGuardando(false);
    }
  }

  const totalSemana = useMemo(
    () =>
      (dias ?? [])
        .filter((d) => d.activo)
        .reduce(
          (n, d) =>
            n +
            bloquesDelDia({ open: d.apertura, close: d.cierre, breakStart: d.pausaInicio, breakEnd: d.pausaFin })
              .length,
          0,
        ),
    [dias],
  );

  if (!dias) {
    return error ? (
      <p role="alert" className="rounded-[10px] bg-bad-bg px-5 py-4 text-sm text-bad">
        {error}
      </p>
    ) : (
      <div className="flex items-center gap-3 py-20 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Cargando el horario…
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <div className="page-head">
        <div>
          <h1>Horario de atención</h1>
          <p>
            Citas de {CITA.duracionMin} minutos, seguidas desde la apertura · {totalSemana} citas por
            semana con este horario
          </p>
        </div>
        <div className="page-actions">
          <button type="button" onClick={() => void guardar()} disabled={guardando} className="btn-primary">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" strokeWidth={2} aria-hidden />}
            Guardar horario
          </button>
        </div>
      </div>

      <p className="ayuda">
        <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
        <span>
          Para un día suelto sin atención —un festivo, un congreso— no cambies el horario: usa
          «Cerrar este día» en la <Link href="/admin/citas" className="font-semibold underline">Agenda</Link>,
          que además avisa a quienes tenían cita.
        </span>
      </p>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-[10px] bg-bad-bg px-5 py-4 text-sm text-bad">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
          {error}
        </p>
      )}

      {guardado && (
        <div role="status" className="rounded-[10px] bg-ok-bg px-5 py-4 text-sm text-ok">
          <p className="flex items-center gap-2 font-semibold">
            <Check className="h-4 w-4" strokeWidth={2.2} aria-hidden />
            Horario guardado. La web ya ofrece los bloques nuevos.
          </p>
          {citasFuera && citasFuera.length > 0 && (
            <div className="mt-3 text-warn">
              <p className="font-semibold">
                {citasFuera.length === 1
                  ? 'Una cita ya agendada quedó por fuera del horario nuevo:'
                  : `${citasFuera.length} citas ya agendadas quedaron por fuera del horario nuevo:`}
              </p>
              <ul className="mt-1 list-disc pl-5">
                {citasFuera.map((c) => (
                  <li key={c.id}>
                    {c.nombre} · {formatDateTime(c.startsAt)}
                  </li>
                ))}
              </ul>
              <p className="mt-1">No se movieron: hay que hablar con esas personas y reagendarlas.</p>
            </div>
          )}
        </div>
      )}

      <div className="panel-card">
        <ul className="divide-y divide-line">
          {ORDEN.map((numero) => {
            const d = dias.find((x) => x.dia === numero)!;
            const horario = { open: d.apertura, close: d.cierre, breakStart: d.pausaInicio, breakEnd: d.pausaFin };
            const bloques = d.activo ? bloquesDelDia(horario) : [];
            const sobra = d.activo ? sobranteDelDia(horario) : 0;
            const conPausa = d.pausaInicio !== null || d.pausaFin !== null;

            return (
              <li key={numero} className="grid gap-4 px-[22px] py-5 lg:grid-cols-[150px_minmax(0,1fr)]">
                <label className="flex items-center gap-3 self-start pt-2">
                  <input
                    type="checkbox"
                    checked={d.activo}
                    onChange={(e) => cambiar(numero, { activo: e.target.checked })}
                    className="h-5 w-5 rounded border-line-strong accent-[rgb(var(--brand-700))]"
                  />
                  <span className="font-semibold">{NOMBRES[numero]}</span>
                </label>

                {d.activo ? (
                  <div className="grid gap-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <Campo etiqueta="Abre" valor={d.apertura} onCambio={(v) => cambiar(numero, { apertura: v })} />
                      <Campo etiqueta="Cierra" valor={d.cierre} onCambio={(v) => cambiar(numero, { cierre: v })} />
                      {conPausa ? (
                        <>
                          <Campo
                            etiqueta="Almuerzo desde"
                            valor={d.pausaInicio ?? ''}
                            onCambio={(v) => cambiar(numero, { pausaInicio: v || null })}
                          />
                          <Campo
                            etiqueta="hasta"
                            valor={d.pausaFin ?? ''}
                            onCambio={(v) => cambiar(numero, { pausaFin: v || null })}
                          />
                          <button
                            type="button"
                            onClick={() => cambiar(numero, { pausaInicio: null, pausaFin: null })}
                            className="btn-text"
                          >
                            Sin almuerzo
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => cambiar(numero, { pausaInicio: '13:00', pausaFin: '14:00' })}
                          className="btn-text"
                        >
                          Agregar almuerzo
                        </button>
                      )}
                    </div>

                    {bloques.length === 0 ? (
                      <p className="text-sm text-bad">
                        Con este horario no cabe ni una cita de {CITA.duracionMin} minutos.
                      </p>
                    ) : (
                      <div>
                        <ul className="flex flex-wrap gap-1.5" aria-label={`Citas del ${NOMBRES[numero].toLowerCase()}`}>
                          {bloques.map((minuto) => (
                            <li
                              key={minuto}
                              className="rounded-md bg-brand-50 px-2 py-1 text-[13px] font-semibold tabular-nums text-brand-700"
                            >
                              {horaEnPalabras(aHora(minuto))}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[13px] text-subtle">
                          {bloques.length} cita{bloques.length === 1 ? '' : 's'}
                          {sobra > 0 ? ` · sobran ${sobra} min al final de ${conPausa ? 'los tramos' : 'la jornada'}` : ''}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="self-center text-sm text-subtle">No se atiende.</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Campo({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <label className="grid gap-1">
      <span className="text-[12.5px] font-semibold text-subtle">{etiqueta}</span>
      <input
        type="time"
        step={300}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="field min-h-10 w-[8.5rem] py-1.5"
      />
    </label>
  );
}
