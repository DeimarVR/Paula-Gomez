'use client';

import { useEffect, useRef } from 'react';

/**
 * Barra de avance de lectura, en el borde inferior de la cabecera.
 *
 * Escribe el progreso en una variable CSS y deja que el compositor haga el
 * resto con un `scaleX`: no se toca el layout en ningún momento. El cálculo se
 * agenda con `requestAnimationFrame`, así que por más eventos de scroll que
 * lleguen solo se hace una medición por fotograma.
 */
export function ScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let pendiente = false;

    const medir = () => {
      pendiente = false;
      const nodo = ref.current;
      if (!nodo) return;

      const recorrido = document.documentElement.scrollHeight - window.innerHeight;
      const avance = recorrido > 0 ? window.scrollY / recorrido : 0;
      nodo.style.setProperty('--progreso', String(Math.min(1, Math.max(0, avance))));
    };

    const alDesplazar = () => {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(medir);
    };

    medir();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', alDesplazar, { passive: true });
    return () => {
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', alDesplazar);
    };
  }, []);

  return <div ref={ref} aria-hidden className="scroll-progress" />;
}
