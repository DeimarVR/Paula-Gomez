'use client';

import { useId } from 'react';
import { etiquetaZona, ZONAS, type ZonaId } from '@/lib/controlEvolutivo';

/**
 * Diagramas del cuero cabelludo para marcar las zonas afectadas.
 *
 * Reemplazan la tira de dibujos de la ficha de papel, donde el profesional
 * rayaba encima con lapicero. Aquí la marca queda como DATO —el identificador
 * de la zona— y no como un trazo, así que se puede comparar entre sesiones y
 * buscar después. Ese es el motivo de hacerlo con clic y no con un lienzo
 * libre.
 *
 * Las zonas se dibujan como rectángulos RECORTADOS contra la silueta de la
 * cabeza (`clipPath`). Es lo que permite que cada zona tenga la forma orgánica
 * del cráneo sin tener que dibujar a mano el contorno de cada una, y garantiza
 * que las áreas de clic no se solapen ni se salgan del dibujo.
 *
 * Los trazos anatómicos (línea de implantación, remolino, oreja) también van
 * recortados contra la silueta cuando corren pegados al borde: por afinada que
 * quede la curva, así no puede escaparse del cráneo.
 */

interface Props {
  marcadas: string[];
  /** Ausente en la vista impresa: ahí el diagrama es solo lectura. */
  onAlternar?: (zona: ZonaId) => void;
  /**
   * Versión reducida para la ficha impresa.
   *
   * En la hoja los tres dibujos van en una fila estrecha; con el tamaño del
   * formulario se apilarían y estirarían el encabezado hasta sacarlo de la
   * página. Medido: con el tamaño grande la ficha ocupaba 302 mm de alto y en
   * una carta horizontal caben 199.
   */
  compacto?: boolean;
  /**
   * Botones de zona a tamaño de dedo aunque los dibujos vayan pequeños.
   *
   * Es el caso del celular: ahí los tres dibujos apilados a tamaño normal se
   * comían media pantalla, pero los botones sí tienen que poderse tocar.
   */
  chipsGrandes?: boolean;
}

/* ------------------------------------------------------------------ *
 * Vista superior
 * ------------------------------------------------------------------ */

/**
 * Silueta vista desde arriba, con la frente hacia arriba.
 *
 * La nariz es un BULTO del propio contorno, no un triángulo dibujado encima:
 * con el triángulo aparte parecía un gorro de fiesta y además dejaba dos
 * vértices sueltos cruzando el óvalo.
 */
const SILUETA_SUPERIOR =
  'M53 9 C55 3 57 1 60 1 C63 1 65 3 67 9 C86 14 108 40 108 82 ' +
  'C108 124 87 150 60 150 C33 150 12 124 12 82 C12 40 34 14 53 9 Z';

/**
 * La misma silueta pero con la nariz cerrada de un tirón: es contra ESTA que
 * se recortan las zonas. Con el contorno completo, marcar el frontal pintaba
 * también la nariz, que no es cuero cabelludo.
 */
const CRANEO_SUPERIOR =
  'M53 9 L67 9 C86 14 108 40 108 82 C108 124 87 150 60 150 ' +
  'C33 150 12 124 12 82 C12 40 34 14 53 9 Z';

/** Orejas de la vista superior: van FUERA de la silueta, sin recortar. */
const OREJA_SUP_IZQ = 'M12 76 C6 74 4 86 7 94 C9 99 12 100 13 97';
const OREJA_SUP_DER = 'M108 76 C114 74 116 86 113 94 C111 99 108 100 107 97';

/**
 * Línea de implantación frontal. Los dos extremos caen SOBRE el contorno
 * (medidos sobre la curva, no a ojo), para que no queden flotando en el aire
 * como pasaba antes.
 */
const IMPLANTACION_SUPERIOR = 'M17 50 C24 27 40 18 60 18 C80 18 96 27 103 50';

/** Remolino de la coronilla, en espiral: es lo que orienta el vértex. */
const REMOLINO =
  'M60 96 C70 96 77 104 77 113 C77 122 70 129 61 129 ' +
  'C53 129 47 123 47 116 C47 110 52 106 58 106 C63 106 66 110 66 114';

/* ------------------------------------------------------------------ *
 * Perfil
 * ------------------------------------------------------------------ */

/**
 * Perfil mirando a la derecha, con cráneo, nariz, labios y mentón.
 *
 * Se probaron cuatro variantes al tamaño real (176 px) y esta fue la única que
 * se lee como una cabeza: el cráneo solo, sin cara, queda como un círculo, y
 * con la cara desproporcionada el rostro parece un apéndice arrugado. Las
 * proporciones son las de una cabeza real —el oído a media altura, la punta de
 * la nariz por delante de la frente, el mentón a 1.4 veces la profundidad del
 * cráneo—, no curvas puestas a ojo.
 */
const SILUETA_PERFIL =
  'M62 8 C88 8 100 26 100 50 C100 58 98 62 96 66 ' +
  'C104 72 118 86 116 90 C114 93 106 92 100 92 ' +
  'C102 100 100 105 95 107 C99 112 99 118 94 123 ' +
  'C90 129 82 132 72 132 C54 132 40 123 32 109 ' +
  'C24 97 16 84 14 66 C12 44 24 20 40 12 C47 9 55 8 62 8 Z';

/**
 * Solo el cráneo: comparte con el perfil los tramos de arriba y de atrás
 * —literalmente las mismas curvas— y se cierra por delante a la altura de la
 * mandíbula. Las zonas se recortan contra ESTE. Si se usara el perfil
 * completo, marcar el frontal pintaría también la nariz y los labios, que no
 * son cuero cabelludo.
 */
const CRANEO_PERFIL =
  'M62 8 C88 8 100 26 100 50 C100 66 94 82 84 92 ' +
  'C74 100 64 103 54 103 C40 103 28 96 22 86 C17 78 14 72 14 66 ' +
  'C12 44 24 20 40 12 C47 9 55 8 62 8 Z';

/**
 * Implantación de perfil: arranca en un punto CALCULADO sobre el contorno
 * —t = 0.28 de la primera curva, (81, 12)— baja por la frente, hace la entrada
 * del temporal y muere en la patilla, por delante de la oreja. Antes arrancaba
 * a ojo fuera de la silueta y dejaba un trazo suelto cruzando el cráneo.
 */
const IMPLANTACION_PERFIL =
  'M81 12 C91 18 96 29 96 44 C89 43 82 48 77 57 C74 63 72 69 71 76';

/** Oreja de perfil: antes era un círculo, que no leía como oreja. */
const OREJA_PERFIL = 'M56 62 C48 60 43 68 44 78 C45 88 52 93 58 89 C62 86 61 80 59 76';
const OREJA_PERFIL_INTERIOR = 'M54 70 C51 72 51 78 54 81';

/**
 * Una zona: rectángulo recortado contra la silueta.
 *
 * Vive FUERA de `DiagramaCabeza` a propósito. Un componente definido dentro de
 * otro cambia de identidad en cada render y React lo remonta; aquí solo
 * costaría trabajo de más, pero en un formulario ese mismo error hace que los
 * campos pierdan el foco a cada tecla.
 */
function Zona({
  zona,
  recorte,
  x,
  y,
  ancho,
  alto,
  marcada,
  interactivo,
  onAlternar,
}: {
  zona: ZonaId;
  recorte: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  marcada: boolean;
  interactivo: boolean;
  onAlternar?: (zona: ZonaId) => void;
}) {
  const comun = {
    x,
    y,
    width: ancho,
    height: alto,
    clipPath: `url(#${recorte})`,
    className: marcada
      ? 'fill-brand-500/70'
      : interactivo
        ? 'fill-transparent hover:fill-brand-200/60'
        : 'fill-transparent',
  };

  if (!interactivo) return <rect {...comun} />;

  return (
    <g
      role="checkbox"
      aria-checked={marcada}
      aria-label={etiquetaZona(zona)}
      tabIndex={0}
      className="cursor-pointer outline-none focus-visible:opacity-70"
      onClick={() => onAlternar?.(zona)}
      onKeyDown={(evento) => {
        // Un elemento con rol de casilla tiene que responder al teclado, o
        // el diagrama queda inservible para quien no usa mouse.
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          onAlternar?.(zona);
        }
      }}
    >
      <rect {...comun} />
    </g>
  );
}

export function DiagramaCabeza({
  marcadas,
  onAlternar,
  compacto = false,
  chipsGrandes = false,
}: Props) {
  const activa = (zona: string) => marcadas.includes(zona);
  const interactivo = Boolean(onAlternar);

  /**
   * Los `clipPath` se referencian por id, y los ids de SVG son globales al
   * documento. Con un id fijo, dos diagramas en la misma página —el del
   * formulario y el de la vista previa, por ejemplo— se recortarían contra la
   * silueta del otro. `useId` da uno único por instancia.
   */
  const base = useId().replace(/:/g, '');
  const corteSuperior = `corte-superior-${base}`;
  const corteIzq = `corte-izq-${base}`;
  const corteDer = `corte-der-${base}`;

  const trazo = 'fill-none stroke-brand-800';
  /**
   * Los trazos decorativos no deben robarle el clic a la zona que tienen
   * debajo: un trazo con `stroke` sí recibe eventos, y la oreja cae justo
   * encima del temporal.
   */
  const detalle = `${trazo} pointer-events-none`;
  const guia = `${trazo} pointer-events-none`;
  const alto = compacto ? 'h-16 w-auto' : 'h-44 w-auto';
  const pie = compacto ? 'mt-0.5 text-[6px] text-ink/70' : 'mt-1 text-xs text-muted';

  return (
    <div>
      <div className={`flex items-start justify-center ${compacto ? 'gap-1.5' : 'flex-wrap gap-6'}`}>
        {/* ---- Vista superior ---------------------------------------- */}
        <figure className="text-center">
          <svg viewBox="0 -2 120 156" className={alto} aria-label="Vista superior de la cabeza">
            <defs>
              <clipPath id={corteSuperior}>
                <path d={CRANEO_SUPERIOR} />
              </clipPath>
            </defs>

            {/* Las zonas van primero para que el contorno quede por encima. */}
            <Zona zona="entradas" recorte={corteSuperior} x={8} y={0} ancho={36} alto={52} marcada={activa('entradas')} interactivo={interactivo} onAlternar={onAlternar} />
            <Zona zona="entradas" recorte={corteSuperior} x={76} y={0} ancho={36} alto={52} marcada={activa('entradas')} interactivo={interactivo} onAlternar={onAlternar} />
            <Zona zona="frontal" recorte={corteSuperior} x={44} y={0} ancho={32} alto={52} marcada={activa('frontal')} interactivo={interactivo} onAlternar={onAlternar} />
            <Zona zona="media" recorte={corteSuperior} x={8} y={52} ancho={104} alto={50} marcada={activa('media')} interactivo={interactivo} onAlternar={onAlternar} />
            <Zona zona="vertex" recorte={corteSuperior} x={8} y={102} ancho={104} alto={54} marcada={activa('vertex')} interactivo={interactivo} onAlternar={onAlternar} />

            {/* Divisiones, recortadas para que mueran en el contorno. */}
            <g clipPath={`url(#${corteSuperior})`} className={guia} strokeWidth={0.8} opacity={0.4}>
              <line x1="0" y1="52" x2="120" y2="52" />
              <line x1="0" y1="102" x2="120" y2="102" />
              <line x1="44" y1="0" x2="44" y2="52" />
              <line x1="76" y1="0" x2="76" y2="52" />
            </g>

            <path d={SILUETA_SUPERIOR} className={detalle} strokeWidth={1.7} />
            <path d={OREJA_SUP_IZQ} className={detalle} strokeWidth={1.4} />
            <path d={OREJA_SUP_DER} className={detalle} strokeWidth={1.4} />
            <path d={IMPLANTACION_SUPERIOR} className={detalle} strokeWidth={1.4} />
            <path d={REMOLINO} className={detalle} strokeWidth={1.3} />
          </svg>
          <figcaption className={pie}>Superior</figcaption>
        </figure>

        {/* ---- Perfil izquierdo --------------------------------------- */}
        <figure className="text-center">
          <svg viewBox="0 0 130 140" className={alto} aria-label="Perfil izquierdo">
            <defs>
              <clipPath id={corteIzq}>
                <path d={CRANEO_PERFIL} />
              </clipPath>
            </defs>
            {/* Espejado: el perfil base mira a la derecha. */}
            <g transform="translate(130 0) scale(-1 1)">
              <Zona zona="vertex" recorte={corteIzq} x={0} y={0} ancho={130} alto={48} marcada={activa('vertex')} interactivo={interactivo} onAlternar={onAlternar} />
              <Zona zona="occipital" recorte={corteIzq} x={0} y={48} ancho={38} alto={62} marcada={activa('occipital')} interactivo={interactivo} onAlternar={onAlternar} />
              <Zona zona="temporal-izq" recorte={corteIzq} x={38} y={48} ancho={38} alto={62} marcada={activa('temporal-izq')} interactivo={interactivo} onAlternar={onAlternar} />
              <Zona zona="frontal" recorte={corteIzq} x={76} y={48} ancho={54} alto={62} marcada={activa('frontal')} interactivo={interactivo} onAlternar={onAlternar} />
              <g clipPath={`url(#${corteIzq})`} className={guia} strokeWidth={0.8} opacity={0.4}>
                <line x1="0" y1="48" x2="130" y2="48" />
                <line x1="38" y1="48" x2="38" y2="140" />
                <line x1="76" y1="48" x2="76" y2="140" />
              </g>
              <path d={SILUETA_PERFIL} className={detalle} strokeWidth={1.7} />
              <g clipPath={`url(#${corteIzq})`}>
                <path d={IMPLANTACION_PERFIL} className={detalle} strokeWidth={1.4} />
              </g>
              <path d={OREJA_PERFIL} className={detalle} strokeWidth={1.4} />
              <path d={OREJA_PERFIL_INTERIOR} className={detalle} strokeWidth={1.1} />
            </g>
          </svg>
          <figcaption className={pie}>Lateral izquierdo</figcaption>
        </figure>

        {/* ---- Perfil derecho ----------------------------------------- */}
        <figure className="text-center">
          <svg viewBox="0 0 130 140" className={alto} aria-label="Perfil derecho">
            <defs>
              <clipPath id={corteDer}>
                <path d={CRANEO_PERFIL} />
              </clipPath>
            </defs>
            <Zona zona="vertex" recorte={corteDer} x={0} y={0} ancho={130} alto={48} marcada={activa('vertex')} interactivo={interactivo} onAlternar={onAlternar} />
            <Zona zona="occipital" recorte={corteDer} x={0} y={48} ancho={38} alto={62} marcada={activa('occipital')} interactivo={interactivo} onAlternar={onAlternar} />
            <Zona zona="temporal-der" recorte={corteDer} x={38} y={48} ancho={38} alto={62} marcada={activa('temporal-der')} interactivo={interactivo} onAlternar={onAlternar} />
            <Zona zona="frontal" recorte={corteDer} x={76} y={48} ancho={54} alto={62} marcada={activa('frontal')} interactivo={interactivo} onAlternar={onAlternar} />
            <g clipPath={`url(#${corteDer})`} className={guia} strokeWidth={0.8} opacity={0.4}>
              <line x1="0" y1="48" x2="130" y2="48" />
              <line x1="38" y1="48" x2="38" y2="140" />
              <line x1="76" y1="48" x2="76" y2="140" />
            </g>
            <path d={SILUETA_PERFIL} className={detalle} strokeWidth={1.7} />
            <g clipPath={`url(#${corteDer})`}>
              <path d={IMPLANTACION_PERFIL} className={detalle} strokeWidth={1.4} />
            </g>
            <path d={OREJA_PERFIL} className={detalle} strokeWidth={1.4} />
            <path d={OREJA_PERFIL_INTERIOR} className={detalle} strokeWidth={1.1} />
          </svg>
          <figcaption className={pie}>Lateral derecho</figcaption>
        </figure>
      </div>

      {/* ---- Lista de zonas ------------------------------------------- */}
      {interactivo ? (
        <div
          className={`flex flex-wrap ${
            compacto && !chipsGrandes ? 'mt-1.5 justify-center gap-1' : 'mt-4 justify-center gap-2'
          }`}
        >
          {/* Además del dibujo, porque acertar un clic en un área pequeña es
              incómodo y el nombre exacto de la zona no siempre es obvio.
              En la hoja van diminutos: a tamaño normal estiraban el encabezado
              y dejaban medio bloque de datos vacío. */}
          {ZONAS.map((zona) => (
            <button
              key={zona.id}
              type="button"
              onClick={() => onAlternar?.(zona.id)}
              aria-pressed={activa(zona.id)}
              className={`rounded-full font-medium transition-colors ${
                compacto && !chipsGrandes ? 'px-1.5 py-0.5 text-[7px]' : 'min-h-11 px-4 text-sm'
              } ${
                activa(zona.id)
                  ? 'bg-brand-700 text-white'
                  : 'border border-line text-ink/75 hover:bg-brand-50'
              }`}
            >
              {zona.etiqueta}
            </button>
          ))}
        </div>
      ) : (
        marcadas.length > 0 && (
          <p className="mt-3 text-center text-[9px] text-ink/80">
            <span className="font-semibold">Zonas marcadas: </span>
            {marcadas.map(etiquetaZona).join(' · ')}
          </p>
        )
      )}
    </div>
  );
}
