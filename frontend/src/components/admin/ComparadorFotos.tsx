'use client';

import { useState } from 'react';
import { Columns2, Maximize2 } from 'lucide-react';
import { VisorFotos, type FotoVisible } from '@/components/admin/VisorFotos';

/**
 * Tira de fotos de un registro, dentro de su tarjeta.
 *
 * Todas las tarjetas se ven igual, tengan las fotos que tengan. Antes, cuando
 * un registro tenía pareja de antes y después, la tarjeta dibujaba el
 * comparador con manija —que lleva `aspect-[4/5]` para el sitio público, donde
 * las tarjetas son estrechas—. En el panel, con dos columnas anchas, esos 4:5
 * se traducían en más de 800 px de alto: una tarjeta ocupaba la pantalla
 * entera y las de al lado quedaban descuadradas.
 *
 * Aquí la tarjeta solo sirve para saber QUÉ hay. Mirar y comparar es trabajo
 * del visor a pantalla completa, que es donde caben de verdad.
 */

const ETIQUETA: Record<FotoVisible['type'], string> = {
  ANTES: 'Antes',
  PROGRESO: 'Progreso',
  DESPUES: 'Después',
};

/**
 * Cuántas miniaturas se dibujan antes de resumir el resto en un «+N».
 *
 * Con una fila que se desplaza, un registro de veinte fotos metía una barra de
 * scroll dentro de la tarjeta. Con el tope, todas las tarjetas miden lo mismo
 * mire uno lo que mire.
 */
const MAXIMO_VISIBLE = 5;

/** Primer ángulo que tenga foto de antes y de después. */
function buscarPareja(
  fotos: FotoVisible[],
): { indiceAntes: number; indiceDespues: number; angulo: string } | null {
  for (const [indiceAntes, antes] of fotos.entries()) {
    if (antes.type !== 'ANTES') continue;
    const indiceDespues = fotos.findIndex(
      (foto) => foto.type === 'DESPUES' && foto.angle === antes.angle,
    );
    if (indiceDespues !== -1) {
      return { indiceAntes, indiceDespues, angulo: antes.angle };
    }
  }
  return null;
}

export function ComparadorFotos({ fotos }: { fotos: FotoVisible[] }) {
  const [visor, setVisor] = useState<{
    a: number;
    b?: number;
    modo: 'una' | 'comparar';
  } | null>(null);

  if (fotos.length === 0) {
    return (
      <p className="mt-4 rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
        Todavía sin fotos.
      </p>
    );
  }

  const pareja = buscarPareja(fotos);
  const visibles = fotos.slice(0, MAXIMO_VISIBLE);
  const ocultas = fotos.length - visibles.length;

  return (
    <>
      <ul className="mt-4 flex gap-2">
        {visibles.map((foto, indice) => (
          <li key={`${foto.url}-${indice}`}>
            <button
              type="button"
              onClick={() => setVisor({ a: indice, modo: 'una' })}
              aria-label={`Ampliar ${ETIQUETA[foto.type]} · ${foto.angle}`}
              className="block overflow-hidden rounded-xl transition-opacity hover:opacity-80"
            >
              {/* Sin `next/image`: la ruta exige la cookie de sesión y el
                  optimizador pide la imagen desde el servidor, sin cookies. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.url} alt="" className="h-20 w-20 object-cover" />
            </button>
            <p className="mt-1 w-20 truncate text-[0.65rem] text-muted">
              {ETIQUETA[foto.type]}
            </p>
          </li>
        ))}

        {ocultas > 0 && (
          <li>
            <button
              type="button"
              onClick={() => setVisor({ a: MAXIMO_VISIBLE, modo: 'una' })}
              className="grid h-20 w-20 place-items-center rounded-xl border border-line bg-brand-50 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
            >
              +{ocultas}
            </button>
          </li>
        )}
      </ul>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={() => setVisor({ a: 0, modo: 'una' })}
          className="flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline"
        >
          <Maximize2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
          Ver en grande
        </button>

        {pareja && (
          <button
            type="button"
            onClick={() =>
              setVisor({ a: pareja.indiceAntes, b: pareja.indiceDespues, modo: 'comparar' })
            }
            className="flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:underline"
          >
            <Columns2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
            Comparar antes y después ({pareja.angulo})
          </button>
        )}
      </div>

      {visor && (
        <VisorFotos
          fotos={fotos}
          indiceInicial={visor.a}
          indiceComparar={visor.b}
          modoInicial={visor.modo}
          onCerrar={() => setVisor(null)}
        />
      )}
    </>
  );
}
