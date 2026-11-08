'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Columns2, Maximize2, X } from 'lucide-react';

/**
 * Visor a pantalla completa de las fotos de un registro.
 *
 * Las miniaturas de la tarjeta sirven para saber qué hay, no para mirar: en 96
 * píxeles no se distingue densidad capilar de sombra. Aquí la foto ocupa la
 * pantalla.
 *
 * Trae dos modos porque el trabajo real es comparar, no contemplar. En «una»
 * se ve una foto grande y se pasa entre ellas; en «comparar» se ven dos a la
 * vez, cada panel con su propio selector, y se puede enfrentar cualquier par
 * —no solo el antes con el después—: a mitad de tratamiento lo que se quiere
 * ver es la del mes pasado contra la de hoy.
 */

export interface FotoVisible {
  url: string;
  type: 'ANTES' | 'PROGRESO' | 'DESPUES';
  angle: string;
  caption?: string | null;
}

const ETIQUETA: Record<FotoVisible['type'], string> = {
  ANTES: 'Antes',
  PROGRESO: 'Progreso',
  DESPUES: 'Después',
};

function describir(foto: FotoVisible): string {
  return `${ETIQUETA[foto.type]} · ${foto.angle}`;
}

/** Un panel: la foto grande con su selector encima. */
function Panel({
  fotos,
  indice,
  onIndice,
  conSelector,
}: {
  fotos: FotoVisible[];
  indice: number;
  onIndice: (indice: number) => void;
  conSelector: boolean;
}) {
  const foto = fotos[indice];
  if (!foto) return null;

  return (
    <figure className="flex min-h-0 min-w-0 flex-1 flex-col">
      {conSelector && (
        <select
          value={indice}
          onChange={(evento) => onIndice(Number(evento.target.value))}
          aria-label="Foto de este panel"
          className="mx-auto mb-3 max-w-full truncate rounded-xl border border-white/25 bg-ink/60 px-3 py-1.5 text-sm text-white"
        >
          {fotos.map((item, i) => (
            <option key={`${item.url}-${i}`} value={i} className="text-ink">
              {describir(item)}
            </option>
          ))}
        </select>
      )}

      {/* `next/image` no sirve aquí: la ruta exige la cookie de sesión y el
          optimizador pide la imagen desde el servidor, que no la manda. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={foto.url}
        alt={describir(foto)}
        className="min-h-0 w-full flex-1 rounded-2xl bg-black/30 object-contain"
      />

      <figcaption className="mt-3 text-center text-sm text-white/80">
        {describir(foto)}
        {foto.caption && <span className="block text-white/60">{foto.caption}</span>}
      </figcaption>
    </figure>
  );
}

export function VisorFotos({
  fotos,
  indiceInicial = 0,
  indiceComparar,
  modoInicial = 'una',
  onCerrar,
}: {
  fotos: FotoVisible[];
  indiceInicial?: number;
  /** Foto del panel derecho. Sin ella, la última del registro. */
  indiceComparar?: number;
  modoInicial?: 'una' | 'comparar';
  onCerrar: () => void;
}) {
  const [modo, setModo] = useState<'una' | 'comparar'>(modoInicial);
  const [a, setA] = useState(indiceInicial);
  /**
   * El segundo panel arranca donde le digan y, si no, en la última foto:
   * comparar la primera con la última es lo que se quiere ver nueve de cada
   * diez veces.
   */
  const [b, setB] = useState(
    indiceComparar ?? (fotos.length > 1 ? fotos.length - 1 : 0),
  );
  const contenedor = useRef<HTMLDivElement>(null);

  const mover = useCallback(
    (paso: number) => setA((actual) => (actual + paso + fotos.length) % fotos.length),
    [fotos.length],
  );

  useEffect(() => {
    /**
     * El visor tapa la página entera, así que el teclado tiene que responder
     * aunque el foco no esté en ningún botón concreto.
     */
    function alPulsar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') onCerrar();
      if (evento.key === 'ArrowRight') mover(1);
      if (evento.key === 'ArrowLeft') mover(-1);
    }

    window.addEventListener('keydown', alPulsar);
    contenedor.current?.focus();

    // Sin esto, la rueda del ratón mueve la página de atrás mientras se mira
    // la foto y al cerrar uno aparece en otro sitio.
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', alPulsar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [mover, onCerrar]);

  if (fotos.length === 0) return null;

  const comparando = modo === 'comparar' && fotos.length > 1;

  return (
    <div
      ref={contenedor}
      role="dialog"
      aria-modal="true"
      aria-label="Fotos del registro"
      tabIndex={-1}
      className="fixed inset-0 z-[60] flex flex-col bg-ink/95 p-4 outline-none sm:p-6"
    >
      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <p className="text-sm text-white/70">
          {comparando ? 'Comparando dos fotos' : `Foto ${a + 1} de ${fotos.length}`}
        </p>

        <div className="flex items-center gap-2">
          {fotos.length > 1 && (
            <button
              type="button"
              onClick={() => setModo(comparando ? 'una' : 'comparar')}
              className="flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
            >
              {comparando ? (
                <>
                  <Maximize2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  Ver una sola
                </>
              ) : (
                <>
                  <Columns2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  Comparar dos
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar el visor"
            className="grid h-10 w-10 place-items-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10"
          >
            <X className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-stretch gap-4">
        {!comparando && fotos.length > 1 && (
          <button
            type="button"
            onClick={() => mover(-1)}
            aria-label="Foto anterior"
            className="hidden shrink-0 self-center rounded-full border border-white/25 p-3 text-white transition-colors hover:bg-white/10 sm:block"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={1.8} aria-hidden />
          </button>
        )}

        <Panel fotos={fotos} indice={a} onIndice={setA} conSelector={comparando} />

        {comparando && <Panel fotos={fotos} indice={b} onIndice={setB} conSelector />}

        {!comparando && fotos.length > 1 && (
          <button
            type="button"
            onClick={() => mover(1)}
            aria-label="Foto siguiente"
            className="hidden shrink-0 self-center rounded-full border border-white/25 p-3 text-white transition-colors hover:bg-white/10 sm:block"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={1.8} aria-hidden />
          </button>
        )}
      </div>

      {/* Tira de miniaturas: en «una» salta a esa foto; en «comparar» cambia el
          panel izquierdo, que es el que se mueve. */}
      {fotos.length > 1 && (
        <div className="mt-4 flex shrink-0 justify-center gap-2 overflow-x-auto pb-1">
          {fotos.map((foto, indice) => (
            <button
              key={`${foto.url}-${indice}`}
              type="button"
              onClick={() => setA(indice)}
              aria-label={`Ver ${describir(foto)}`}
              aria-current={indice === a}
              className={`shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${
                indice === a
                  ? 'border-white'
                  : indice === b && comparando
                    ? 'border-white/50'
                    : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={foto.url} alt="" className="h-14 w-14 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
