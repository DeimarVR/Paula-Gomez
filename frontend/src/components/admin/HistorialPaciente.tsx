'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Camera,
  ClipboardList,
  CalendarDays,
  FileSignature,
  Loader2,
  Package,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { formatDateShort } from '@/lib/format';
import type { Hecho, TipoHecho } from '@/lib/types';

/**
 * Historial del paciente, todo junto y en orden.
 *
 * Cada módulo guardaba bien su parte —fichas, fotos, productos, citas— pero para reconstruir qué se le había hecho a alguien había que
 * abrir cuatro pantallas y ordenar de cabeza. Esto es ese sitio donde se juntan.
 *
 * El orden es del más reciente al más antiguo: una historia clínica se consulta
 * hacia atrás, no desde el principio.
 */

const ESTILO: Record<TipoHecho, { icono: typeof ClipboardList; etiqueta: string; color: string }> = {
  'ficha-capilar': {
    icono: ClipboardList,
    etiqueta: 'Ficha capilar',
    color: 'bg-brand-100 text-brand-800',
  },
  'ficha-facial': {
    icono: Sparkles,
    etiqueta: 'Ficha facial',
    color: 'bg-warn-bg text-warn',
  },
  consentimiento: {
    icono: FileSignature,
    etiqueta: 'Consentimiento',
    color: 'bg-brand-100 text-brand-800',
  },
  fotos: { icono: Camera, etiqueta: 'Fotos', color: 'bg-ok-bg text-ok' },
  producto: { icono: Package, etiqueta: 'Producto', color: 'bg-brand-50 text-brand-700' },
  cita: { icono: CalendarDays, etiqueta: 'Cita', color: 'bg-line/60 text-ink/70' },
};

const FILTROS: Array<{ valor: TipoHecho | ''; etiqueta: string }> = [
  { valor: '', etiqueta: 'Todo' },
  { valor: 'ficha-capilar', etiqueta: 'Capilar' },
  { valor: 'ficha-facial', etiqueta: 'Facial' },
  { valor: 'consentimiento', etiqueta: 'Consentimientos' },
  { valor: 'fotos', etiqueta: 'Fotos' },
  { valor: 'producto', etiqueta: 'Productos' },
  { valor: 'cita', etiqueta: 'Citas' },
];

export function HistorialPaciente({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<Hecho[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<TipoHecho | ''>('');

  useEffect(() => {
    void (async () => {
      try {
        const datos = await api.get<{ items: Hecho[] }>(`/api/patients/${patientId}/historial`);
        setItems(datos.items);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No pudimos cargar el historial');
      } finally {
        setCargando(false);
      }
    })();
  }, [patientId]);

  const visibles = filtro ? items.filter((h) => h.tipo === filtro) : items;

  /** Cuántos hay de cada clase, para no ofrecer filtros que no dan nada. */
  const conteo = new Map<TipoHecho, number>();
  for (const hecho of items) conteo.set(hecho.tipo, (conteo.get(hecho.tipo) ?? 0) + 1);

  return (
    <section className="mt-10">
      <h2 className="font-display text-xl">Historial</h2>
      <p className="mt-1 text-sm text-muted">
        Todo lo registrado de este paciente, de lo más reciente a lo más antiguo.
      </p>

      {cargando ? (
        <div className="flex items-center gap-3 py-12 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : error ? (
        <p className="mt-4 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center text-sm text-muted">
          Todavía no hay nada registrado para este paciente.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {FILTROS.filter((f) => f.valor === '' || conteo.has(f.valor)).map((f) => (
              <button
                key={f.valor}
                type="button"
                onClick={() => setFiltro(f.valor)}
                aria-pressed={filtro === f.valor}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                  filtro === f.valor
                    ? 'bg-brand-700 text-white'
                    : 'border border-line text-ink/75 hover:bg-brand-50'
                }`}
              >
                {f.etiqueta}
                {f.valor !== '' && (
                  <span className="ml-1.5 tabular-nums opacity-70">{conteo.get(f.valor)}</span>
                )}
              </button>
            ))}
          </div>

          <ol className="mt-5 space-y-2">
            {visibles.map((hecho) => {
              const estilo = ESTILO[hecho.tipo];
              const Icono = estilo.icono;

              const contenido = (
                <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${estilo.color}`}
                  >
                    <Icono className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium">{hecho.titulo}</span>
                      <span className="text-xs text-muted">{estilo.etiqueta}</span>
                    </div>
                    {hecho.detalle && (
                      <p className="mt-0.5 text-sm text-muted">{hecho.detalle}</p>
                    )}
                  </div>

                  <span className="shrink-0 text-xs text-muted">
                    {formatDateShort(hecho.fecha)}
                  </span>
                </div>
              );

              return (
                <li key={`${hecho.tipo}-${hecho.id}`}>
                  {hecho.enlace ? (
                    <Link href={hecho.enlace} className="block hover:opacity-80">
                      {contenido}
                    </Link>
                  ) : (
                    contenido
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
