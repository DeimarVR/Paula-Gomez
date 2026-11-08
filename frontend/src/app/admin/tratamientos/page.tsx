'use client';

import { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Plus, Power, Sparkles } from 'lucide-react';
import { api, ApiError } from '@/lib/apiClient';
import { formatCop, formatDuration } from '@/lib/format';
import type { Service } from '@/lib/types';

interface ServicioAdmin extends Service {
  _count: { plans: number; appointments: number };
}

/** Los campos que se editan aquí, en el orden del formulario. */
const VACIO = {
  name: '',
  slug: '',
  shortDesc: '',
  description: '',
  durationMin: '60',
  priceCop: '',
  sessionsAdvice: '',
  category: 'General',
  sortOrder: '0',
  featured: false,
  active: true,
  published: true,
};

type Formulario = typeof VACIO;

/** El motivo bajo la casilla, cuando lo hay. Vive fuera del formulario para que React no lo remonte en cada tecla. */
function Motivo({ texto }: { texto?: string }) {
  if (!texto) return null;
  return <p className="mt-1 text-xs text-bad">{texto}</p>;
}

export default function TratamientosPage() {
  const [items, setItems] = useState<ServicioAdmin[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<ServicioAdmin | null>(null);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await api.get<{ items: ServicioAdmin[] }>('/api/treatments');
      setItems(datos.items);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar los tratamientos');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function alternar(servicio: ServicioAdmin, campo: 'active' | 'published') {
    setError(null);
    try {
      await api.put(`/api/treatments/${servicio.id}`, { [campo]: !servicio[campo] });
      void cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos actualizar el tratamiento');
    }
  }

  const sinPublicar = items.filter((s) => s.active && !s.published).length;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Tratamientos</h1>
          <p className="mt-2 text-muted">
            El catálogo del centro. De aquí salen los precios, la duración de cada cita y lo
            que se ve en la página pública.
          </p>
        </div>
        <button type="button" onClick={() => setCreando(true)} className="btn-primary">
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Nuevo tratamiento
        </button>
      </div>

      {sinPublicar > 0 && (
        <p className="mt-6 rounded-2xl bg-warn-bg px-5 py-4 text-sm text-warn">
          Hay {sinPublicar} {sinPublicar === 1 ? 'tratamiento' : 'tratamientos'} sin publicar.
          Se pueden usar en el panel, pero no salen en la web hasta que les escribas la
          descripción y les des «Publicar».
        </p>
      )}

      {error && <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>}

      {cargando && items.length === 0 ? (
        <div className="flex items-center gap-3 py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((servicio) => (
            <article
              key={servicio.id}
              className={`flex flex-wrap items-center gap-4 rounded-2xl border p-4 ${
                servicio.active ? 'border-line bg-surface' : 'border-dashed border-line bg-cream/50'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg leading-tight">{servicio.name}</h2>
                  {!servicio.active && (
                    <span className="rounded-full bg-line/60 px-2 py-0.5 text-xs text-ink/70">
                      Inactivo
                    </span>
                  )}
                  {servicio.active && !servicio.published && (
                    <span className="rounded-full bg-warn-bg px-2 py-0.5 text-xs text-warn">
                      Sin publicar
                    </span>
                  )}
                  {servicio.featured && (
                    <span className="flex items-center gap-1 rounded-full bg-ok-bg px-2 py-0.5 text-xs text-ok">
                      <Sparkles className="h-3 w-3" strokeWidth={2} aria-hidden />
                      Destacado
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted">
                  {servicio.category} · {formatDuration(servicio.durationMin)} ·{' '}
                  {formatCop(servicio.priceCop)}
                  {servicio._count.appointments > 0 &&
                    ` · ${servicio._count.appointments} citas`}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => alternar(servicio, 'published')}
                  disabled={!servicio.active}
                  className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm transition-colors hover:bg-cream disabled:opacity-40"
                >
                  {servicio.published ? (
                    <>
                      <EyeOff className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                      Quitar de la web
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                      Publicar
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => alternar(servicio, 'active')}
                  className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm transition-colors hover:bg-cream"
                >
                  <Power className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  {servicio.active ? 'Desactivar' : 'Activar'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditando(servicio)}
                  className="rounded-xl border border-line px-3 py-2 text-sm font-medium transition-colors hover:bg-brand-50 hover:text-brand-800"
                >
                  Editar
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {(creando || editando) && (
        <DialogoServicio
          servicio={editando}
          onCerrar={() => {
            setCreando(false);
            setEditando(null);
          }}
          onGuardado={() => {
            setCreando(false);
            setEditando(null);
            void cargar();
          }}
        />
      )}
    </div>
  );
}

function DialogoServicio({
  servicio,
  onCerrar,
  onGuardado,
}: {
  servicio: ServicioAdmin | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState<Formulario>(() =>
    servicio
      ? {
          name: servicio.name,
          slug: servicio.slug,
          shortDesc: servicio.shortDesc,
          description: servicio.description,
          durationMin: String(servicio.durationMin),
          priceCop: servicio.priceCop === null ? '' : String(servicio.priceCop),
          sessionsAdvice: servicio.sessionsAdvice === null ? '' : String(servicio.sessionsAdvice),
          category: servicio.category,
          sortOrder: String(servicio.sortOrder),
          featured: servicio.featured,
          active: servicio.active,
          published: servicio.published,
        }
      : VACIO,
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * Qué campo rechazó el servidor y por qué.
   *
   * El aviso rojo de arriba ya dice el motivo, pero en un formulario de diez
   * campos leer «la duración mínima es de 5 minutos» y tener que buscar cuál es
   * la casilla de la duración sigue siendo trabajo. Esto la señala.
   */
  const [fallos, setFallos] = useState<Record<string, string>>({});

  const casilla =
    'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25';
  const casillaMal =
    'w-full rounded-xl border border-bad/40 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-bad focus:ring-2 focus:ring-bad/40';

  /** Las clases del campo, en rojo si fue el que falló. */
  function clase(clave: string): string {
    return fallos[clave] ? casillaMal : casilla;
  }

  function campo(clave: keyof Formulario, valor: string | boolean) {
    setForm((actual) => ({ ...actual, [clave]: valor }));
    // Al corregirlo, la marca roja sobra: se quita al primer cambio.
    setFallos((actuales) => {
      if (!actuales[clave]) return actuales;
      const resto = { ...actuales };
      delete resto[clave];
      return resto;
    });
  }

  function aNumero(valor: string): number | null {
    if (!valor.trim()) return null;
    const n = Number.parseInt(valor.replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? null : n;
  }

  async function guardar() {
    setError(null);
    setFallos({});

    const cuerpo = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      shortDesc: form.shortDesc.trim(),
      description: form.description.trim(),
      durationMin: aNumero(form.durationMin) ?? 60,
      priceCop: aNumero(form.priceCop),
      sessionsAdvice: aNumero(form.sessionsAdvice),
      category: form.category.trim() || 'General',
      sortOrder: aNumero(form.sortOrder) ?? 0,
      featured: form.featured,
      active: form.active,
      published: form.published,
    };

    setGuardando(true);
    try {
      if (servicio) await api.put(`/api/treatments/${servicio.id}`, cuerpo);
      else await api.post('/api/treatments', cuerpo);
      onGuardado();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setFallos(
          Object.fromEntries(
            (caught.details ?? []).map((detalle) => [detalle.field, detalle.message]),
          ),
        );
      } else {
        setError('No pudimos guardar el tratamiento. Revisa los datos.');
      }
      setGuardando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={servicio ? 'Editar tratamiento' : 'Nuevo tratamiento'}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar();
      }}
    >
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-surface p-6 shadow-lift">
        <h3 className="font-display text-xl">
          {servicio ? 'Editar tratamiento' : 'Nuevo tratamiento'}
        </h3>
        <p className="mt-1 text-sm text-muted">
          La descripción corta y la larga son las que se leen en la página pública.
        </p>

        {error && (
          <p className="mt-4 rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">{error}</p>
        )}

        <div className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="s-name" className="mb-1.5 block text-sm font-medium">Nombre</label>
              <input id="s-name" value={form.name} onChange={(e) => campo('name', e.target.value)} className={clase('name')} aria-invalid={Boolean(fallos.name)} />
              <Motivo texto={fallos.name} />
            </div>
            <div>
              <label htmlFor="s-slug" className="mb-1.5 block text-sm font-medium">
                Slug <span className="font-normal text-muted">(la dirección en la web)</span>
              </label>
              <input id="s-slug" value={form.slug} onChange={(e) => campo('slug', e.target.value)} className={clase('slug')} aria-invalid={Boolean(fallos.slug)} placeholder="consulta-de-control" />
              <Motivo texto={fallos.slug} />
            </div>
          </div>

          <div>
            <label htmlFor="s-short" className="mb-1.5 block text-sm font-medium">
              Descripción corta <span className="font-normal text-muted">(mínimo 10 caracteres)</span>
            </label>
            <input id="s-short" value={form.shortDesc} onChange={(e) => campo('shortDesc', e.target.value)} className={clase('shortDesc')} aria-invalid={Boolean(fallos.shortDesc)} />
            <Motivo texto={fallos.shortDesc} />
          </div>

          <div>
            <label htmlFor="s-desc" className="mb-1.5 block text-sm font-medium">
              Descripción <span className="font-normal text-muted">(mínimo 20 caracteres)</span>
            </label>
            <textarea id="s-desc" rows={4} value={form.description} onChange={(e) => campo('description', e.target.value)} className={`${clase('description')} resize-y`} aria-invalid={Boolean(fallos.description)} />
            <Motivo texto={fallos.description} />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label htmlFor="s-dur" className="mb-1.5 block text-sm font-medium">
                Duración <span className="font-normal text-muted">(min)</span>
              </label>
              <input id="s-dur" inputMode="numeric" value={form.durationMin} onChange={(e) => campo('durationMin', e.target.value)} className={clase('durationMin')} aria-invalid={Boolean(fallos.durationMin)} />
              <Motivo texto={fallos.durationMin} />
            </div>
            <div>
              <label htmlFor="s-price" className="mb-1.5 block text-sm font-medium">Precio</label>
              <input id="s-price" inputMode="numeric" value={form.priceCop} onChange={(e) => campo('priceCop', e.target.value)} className={clase('priceCop')} aria-invalid={Boolean(fallos.priceCop)} placeholder="Consultar" />
              <Motivo texto={fallos.priceCop} />
            </div>
            <div>
              <label htmlFor="s-ses" className="mb-1.5 block text-sm font-medium">Sesiones</label>
              <input id="s-ses" inputMode="numeric" value={form.sessionsAdvice} onChange={(e) => campo('sessionsAdvice', e.target.value)} className={clase('sessionsAdvice')} aria-invalid={Boolean(fallos.sessionsAdvice)} />
              <Motivo texto={fallos.sessionsAdvice} />
            </div>
            <div>
              <label htmlFor="s-cat" className="mb-1.5 block text-sm font-medium">Categoría</label>
              <input id="s-cat" value={form.category} onChange={(e) => campo('category', e.target.value)} className={clase('category')} aria-invalid={Boolean(fallos.category)} />
              <Motivo texto={fallos.category} />
            </div>
          </div>

          <div className="flex flex-wrap gap-5 rounded-xl border border-line p-4">
            {([
              { clave: 'active' as const, etiqueta: 'Activo', ayuda: 'Se puede usar dentro del centro' },
              { clave: 'published' as const, etiqueta: 'Publicado', ayuda: 'Sale en la página pública' },
              { clave: 'featured' as const, etiqueta: 'Destacado', ayuda: 'Aparece en la portada' },
            ]).map((opcion) => (
              <label key={opcion.clave} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form[opcion.clave]}
                  onChange={(e) => campo(opcion.clave, e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-line text-brand-700 focus:ring-brand-400"
                />
                <span>
                  {opcion.etiqueta}
                  <span className="block text-xs text-muted">{opcion.ayuda}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCerrar} className="rounded-xl border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-cream">
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={guardando} className="btn-primary disabled:pointer-events-none disabled:opacity-60">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
