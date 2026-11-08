'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { MoveHorizontal } from 'lucide-react';

interface BeforeAfterSliderProps {
  beforeUrl: string;
  afterUrl: string;
  beforeAlt?: string;
  afterAlt?: string;
  className?: string;
  /**
   * Carga las fotos sin pasar por el optimizador de imágenes.
   *
   * Hace falta en el panel. Las fotos viven en `/api/archivos`, que es una
   * ruta protegida: comprueba la cookie de sesión antes de entregar los bytes.
   * El optimizador de Next no pide la imagen desde el navegador sino desde el
   * servidor, y esa petición NO lleva la cookie, así que toda foto que aún no
   * sea pública vuelve como 401 y se ve rota. Sin optimizador, la pide el
   * navegador y la cookie viaja sola.
   *
   * En el sitio público se deja optimizando: allí las fotos ya están
   * publicadas, la ruta las entrega sin sesión y el ahorro de peso sí importa.
   */
  sinOptimizar?: boolean;
}

/**
 * Comparador antes/después con manija arrastrable.
 *
 * Accesible con teclado: el separador es un `slider` ARIA que responde a las
 * flechas, así que la comparación no depende de poder arrastrar con el mouse.
 */
export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeAlt = 'Antes del tratamiento',
  afterAlt = 'Después del tratamiento',
  className = '',
  sinOptimizar = false,
}: BeforeAfterSliderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = useCallback((clientX: number) => {
    const node = containerRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, ratio)));
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setPosition((value) => Math.max(0, value - step));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      setPosition((value) => Math.min(100, value + step));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setPosition(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setPosition(100);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative aspect-[4/5] select-none overflow-hidden rounded-3xl bg-brand-900 ${className}`}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        updateFromClientX(event.clientX);
      }}
      onPointerMove={(event) => {
        if (dragging) updateFromClientX(event.clientX);
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
    >
      {/* Imagen "después": queda al fondo, completa. */}
      <Image
        src={afterUrl}
        alt={afterAlt}
        fill
        sizes="(min-width: 1024px) 33vw, 100vw"
        unoptimized={sinOptimizar}
        className="object-cover"
      />

      {/* Imagen "antes": se recorta según la posición de la manija. */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <Image
          src={beforeUrl}
          alt={beforeAlt}
          fill
          sizes="(min-width: 1024px) 33vw, 100vw"
          unoptimized={sinOptimizar}
          className="object-cover"
        />
      </div>

      <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-brand-900/75 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-white backdrop-blur-sm">
        Antes
      </span>
      <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-accent-500/95 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wider text-brand-900">
        Después
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.35)]"
        style={{ left: `${position}%` }}
      />

      <button
        type="button"
        role="slider"
        aria-label="Comparar antes y después"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${Math.round(position)}% de la imagen "antes" visible`}
        onKeyDown={handleKeyDown}
        className="absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-white/95 text-brand-800 shadow-lift transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent-500"
        style={{ left: `${position}%` }}
      >
        <MoveHorizontal className="h-5 w-5" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
