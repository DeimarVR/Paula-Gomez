'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * Entrada suave al cambiar de página.
 *
 * La clave es `pathname`: React desmonta el contenido anterior y monta el
 * nuevo, así que la animación de entrada vuelve a correr en cada navegación.
 * No hay animación de salida —eso exigiría mantener vivo el árbol viejo, y no
 * compensa la complejidad—, pero el navegador ya conserva la página anterior
 * hasta que la nueva está lista, así que el corte no se nota.
 *
 * La animación termina en `transform: none` para no dejar al contenedor
 * bloqueando los elementos `position: fixed` que haya dentro, y el bloque de
 * "movimiento reducido" de globals.css la desactiva por completo.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-enter">
      {children}
    </div>
  );
}
