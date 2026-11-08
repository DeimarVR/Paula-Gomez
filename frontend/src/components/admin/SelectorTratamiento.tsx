'use client';

import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import { api, ApiError } from '@/lib/apiClient';
import type { Service } from '@/lib/types';

/**
 * Selector de tratamiento con alta rápida.
 *
 * Existe para que agregar un tratamiento nuevo no dependa de que alguien toque
 * el código. Se usa en todos los sitios donde hay que elegir uno: plan de
 * tratamiento, próximo control de la ficha y galería.
 *
 * Lo que crea nace SIN PUBLICAR: sirve de inmediato en el panel,
 * pero no sale en la web hasta que alguien complete su descripción en
 * Tratamientos. Así se puede atender sin trabas sin que la página pública
 * muestre una ficha vacía.
 */

interface Props {
  value: string;
  onChange: (serviceId: string) => void;
  servicios: Service[];
  /** Se llama con el tratamiento recién creado, para refrescar la lista. */
  onCreado: (servicio: Service) => void;
  id?: string;
  className?: string;
  /** Texto de la opción vacía. Si falta, no hay opción vacía. */
  placeholder?: string;
  disabled?: boolean;
}

export function SelectorTratamiento({
  value,
  onChange,
  servicios,
  onCreado,
  id,
  className = '',
  placeholder,
  disabled = false,
}: Props) {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      {/*
        `min-w-0` en los dos, y no es cosmético.

        Un `<select>` reclama de ancho lo que mida su opción más larga, y como
        ítem flexible su `min-width` vale `auto`, así que se niega a encogerse
        por debajo de eso. Con nombres como «Limpieza profunda de cuero
        cabelludo» el desplegable pedía más de lo que mide un teléfono y era el
        formulario entero el que se iba de lado: en el móvil se podía arrastrar
        la pantalla a los lados y la mitad de los campos quedaba fuera. Apareció
        al cargar los tratamientos nuevos, que traen los nombres más largos.
      */}
      <div className="flex min-w-0 items-center gap-2">
        <select
          id={id}
          value={value}
          onChange={(evento) => onChange(evento.target.value)}
          disabled={disabled}
          className={`${className || 'field-input flex-1'} min-w-0`}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {servicios.map((servicio) => (
            <option key={servicio.id} value={servicio.id}>
              {servicio.name}
              {servicio.published ? '' : ' · sin publicar'}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setAbierto(true)}
          disabled={disabled}
          title="Crear un tratamiento nuevo"
          aria-label="Crear un tratamiento nuevo"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2.2} aria-hidden />
        </button>
      </div>

      {abierto && (
        <DialogoTratamiento
          onCerrar={() => setAbierto(false)}
          onCreado={(servicio) => {
            onCreado(servicio);
            onChange(servicio.id);
            setAbierto(false);
          }}
        />
      )}
    </>
  );
}

function DialogoTratamiento({
  onCerrar,
  onCreado,
}: {
  onCerrar: () => void;
  onCreado: (servicio: Service) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [duracion, setDuracion] = useState('60');
  const [precio, setPrecio] = useState('');
  const [sesiones, setSesiones] = useState('');
  const [categoria, setCategoria] = useState('Capilar');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const casilla =
    'w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25';

  /** Texto → entero, sin dejar pasar NaN. */
  function aNumero(valor: string): number | null {
    if (!valor.trim()) return null;
    const n = Number.parseInt(valor.replace(/\D/g, ''), 10);
    return Number.isNaN(n) ? null : n;
  }

  async function crear() {
    setError(null);
    if (nombre.trim().length < 3) {
      setError('Escribe el nombre del tratamiento.');
      return;
    }

    setGuardando(true);
    try {
      const servicio = await api.post<Service>('/api/treatments/rapido', {
        name: nombre.trim(),
        durationMin: aNumero(duracion) ?? 60,
        priceCop: aNumero(precio),
        sessionsAdvice: aNumero(sesiones),
        category: categoria.trim() || 'Capilar',
      });
      onCreado(servicio);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'No pudimos crear el tratamiento. Intenta de nuevo.',
      );
      setGuardando(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Nuevo tratamiento"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-lift">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-lg">Nuevo tratamiento</h3>
            <p className="mt-1 text-xs text-muted">
              Queda disponible al instante en el panel. No sale en la web hasta
              que le escribas la descripción en Tratamientos.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-cream"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">{error}</p>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="trat-nombre" className="mb-1.5 block text-sm font-medium">
              Nombre
            </label>
            <input
              id="trat-nombre"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              className={casilla}
              placeholder="Mesoterapia capilar"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="trat-duracion" className="mb-1.5 block text-sm font-medium">
                Duración (min)
              </label>
              <input
                id="trat-duracion"
                inputMode="numeric"
                value={duracion}
                onChange={(evento) => setDuracion(evento.target.value)}
                className={casilla}
              />
              <p className="mt-1 text-xs text-muted">Define el bloque que ocupa en la agenda.</p>
            </div>
            <div>
              <label htmlFor="trat-precio" className="mb-1.5 block text-sm font-medium">
                Precio <span className="font-normal text-muted">(opcional)</span>
              </label>
              <input
                id="trat-precio"
                inputMode="numeric"
                value={precio}
                onChange={(evento) => setPrecio(evento.target.value)}
                className={casilla}
                placeholder="100000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="trat-sesiones" className="mb-1.5 block text-sm font-medium">
                Sesiones sugeridas <span className="font-normal text-muted">(opcional)</span>
              </label>
              <input
                id="trat-sesiones"
                inputMode="numeric"
                value={sesiones}
                onChange={(evento) => setSesiones(evento.target.value)}
                className={casilla}
              />
            </div>
            <div>
              <label htmlFor="trat-categoria" className="mb-1.5 block text-sm font-medium">
                Categoría
              </label>
              <input
                id="trat-categoria"
                value={categoria}
                onChange={(evento) => setCategoria(evento.target.value)}
                className={casilla}
                placeholder="Capilar"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium transition-colors hover:bg-cream"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={crear}
            disabled={guardando}
            className="btn-primary disabled:pointer-events-none disabled:opacity-60"
          >
            {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Crear tratamiento
          </button>
        </div>
      </div>
    </div>
  );
}
