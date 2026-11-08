'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronDown, CopyPlus, Plus, Trash2 } from 'lucide-react';
import { DiagramaCabeza } from './DiagramaCabeza';
import { SelectorTratamiento } from './SelectorTratamiento';
import { NombrePacienteHoja, type PacienteEncontrado } from './NombrePacienteHoja';
import { SelectorHoraControl } from './SelectorHoraControl';
import { claveFecha, partesFecha, telefonoLocal } from '@/lib/format';
import { LEGAL, SITE } from '@/lib/config';
import type { Service } from '@/lib/types';
import {
  ANCHO_HOJA_EDITABLE,
  ANCHO_MINIMO_HOJA,
  ANCHO_MINIMO_SIN_APILAR,
  ESCALA_MINIMA_HOJA,
  CAMPOS_CABECERA,
  COLUMNAS,
  FILAS_CABECERA,
  FILAS_MINIMAS,
  TIPOS_ATENCION,
  SUGERENCIAS_ZONA,
  TITULO_TABLA,
  etiquetaZona,
  type CampoCabecera,
  type DatosHoja,
  type LineaControl,
  type ZonaId,
} from '@/lib/controlEvolutivo';

/**
 * La ficha del control de pacientes: una definición, cuatro presentaciones.
 *
 * Modos: `lectura` (lo que se imprime) y `edicion` (el formulario).
 * Disposiciones: `hoja`, calcada del papel, y `apilada`, para celular y tablet
 * en vertical.
 *
 * Las cuatro salen de las mismas listas —`CAMPOS_CABECERA` y `COLUMNAS`— a
 * propósito. Mantener maquetados paralelos del mismo documento garantiza que
 * agregar un campo se quede a medias en alguno.
 *
 * ⚠️ TODAS las piezas de abajo viven FUERA del componente principal, y tienen
 * que seguir así. Una función de componente definida dentro de otra se vuelve
 * a crear en cada render, así que React la ve como un componente DISTINTO,
 * desmonta el subárbol y lo monta de nuevo. En un formulario eso se siente
 * como que el campo pierde el foco a cada tecla y toca volver a hacer clic.
 * Ese error ya ocurrió aquí; `npm run check:componentes` lo detecta.
 */

const PASTILLA =
  'inline-block shrink-0 rounded-md bg-brand-700 px-2 py-0.5 text-[7.5px] font-bold uppercase tracking-wide text-white';
const SUBRAYADO = 'border-b border-brand-700 px-1 text-[10px] leading-tight';
const MARCA =
  'flex h-2.5 w-2.5 shrink-0 items-center justify-center border border-brand-700 text-[8px] font-black leading-none text-bad';
const CELDA = 'border border-brand-700/60 px-1.5 py-1 align-top text-[8.5px]';
const CAMPO_APILADO =
  'min-h-11 w-full rounded-xl border border-line bg-white px-3 text-base outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25';
const ETIQUETA_APILADA = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-700';
const LECTURA_APILADA = 'min-h-11 rounded-xl border border-line bg-white px-3 py-2.5 text-base';

type Quien = 'professional' | 'patient';
type CampoSimple = Extract<CampoCabecera, { clave: string }>;

/** Lo que comparten todas las piezas de la hoja. */
interface Hoja {
  datos: DatosHoja;
  editable: boolean;
  /** Catálogo para elegir el tratamiento del próximo control. */
  servicios: Service[];
  /** Alta rápida de tratamiento. La hoja no crea nada: avisa hacia arriba. */
  onNuevoTratamiento?: (servicio: Service) => void;
  onCambio?: (parche: Partial<DatosHoja>) => void;
  onCambioLinea?: (indice: number, parche: Partial<LineaControl>) => void;
  onQuitarLinea?: (indice: number) => void;
  onFirmar?: (indice: number, quien: Quien) => void;
  /** Ficha de la historia detrás del nombre, si ya se eligió una. */
  pacienteVinculado?: boolean;
  /** Se eligió un paciente desde el propio campo NOMBRE. */
  onElegirPaciente?: (paciente: PacienteEncontrado) => void;
  /** Nombres de lo que hay en inventario, para sugerir la medicación. */
  productos: string[];
}

/* -------------------------------------------------------------------------
 * Lectura y escritura de campos
 * ---------------------------------------------------------------------- */

const numero = (valor: number | null) => (valor === null ? '' : String(valor));

/** Texto → número o null, sin dejar pasar NaN. */
function aNumero(valor: string): number | null {
  if (!valor.trim()) return null;
  const n = Number.parseInt(valor.replace(/\D/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

const esFecha = (clave: keyof LineaControl) => clave === 'sessionDate' || clave === 'nextControl';

function valorDe(hoja: Hoja, campo: CampoSimple): string {
  const { datos, editable } = hoja;

  if (campo.tipo === 'numero') return numero(datos[campo.clave]);
  if (campo.tipo === 'fecha') return claveFecha(datos.procedureDate);

  // El teléfono se guarda en formato internacional; en la ficha se muestran
  // los diez dígitos locales, como en el papel.
  if (campo.clave === 'patientPhone' && !editable) return telefonoLocal(datos.patientPhone);
  return datos[campo.clave] ?? '';
}

function escribirEn(hoja: Hoja, campo: CampoSimple, valor: string) {
  if (campo.tipo === 'numero') {
    hoja.onCambio?.({ [campo.clave]: aNumero(valor) } as Partial<DatosHoja>);
  } else if (campo.tipo === 'fecha') {
    hoja.onCambio?.({ procedureDate: valor });
  } else {
    hoja.onCambio?.({ [campo.clave]: valor || null } as Partial<DatosHoja>);
  }
}

function alternarZonaTrasplante(hoja: Hoja, zona: number) {
  const actuales = hoja.datos.transplantZones;
  hoja.onCambio?.({
    transplantZones: actuales.includes(zona)
      ? actuales.filter((z) => z !== zona)
      : [...actuales, zona].sort((a, b) => a - b),
  });
}

/**
 * Marca o desmarca una zona en los diagramas, y la lleva a «Zona tratada».
 *
 * Marcar una zona y que solo apareciera junto a las cabezas no servía de nada:
 * lo que hay que escribir en la ficha es la columna, y quedaba en manos de
 * acordarse de pulsar el botoncito de cada fila.
 *
 * Pero copiar a lo bruto tampoco vale: la columna dice qué se trató EN CADA
 * SESIÓN, y sobreescribirla dejaría las sesiones anteriores diciendo algo que
 * no pasó. Así que solo se toca UNA fila, y solo si es nuestra:
 *
 *   1. la que ya rellenamos antes —se reconoce porque tiene exactamente el
 *      texto de las zonas anteriores—, para que marcar una segunda zona
 *      actualice esa misma fila en vez de saltar a la siguiente;
 *   2. si no hay ninguna, la primera que esté en blanco.
 *
 * Una fila con algo escrito a mano no se toca nunca. Y si se desmarcan todas
 * las zonas, la fila que habíamos rellenado se vacía: era nuestra.
 */
function alternarZonaMarcada(hoja: Hoja, zona: ZonaId) {
  const actuales = hoja.datos.markedZones;
  const nuevas = actuales.includes(zona)
    ? actuales.filter((z) => z !== zona)
    : [...actuales, zona];

  hoja.onCambio?.({ markedZones: nuevas });

  if (!hoja.onCambioLinea) return;

  const comoTexto = (zonas: string[]) =>
    zonas.length > 0 ? zonas.map((z) => etiquetaZona(z)).join(' · ') : null;

  const antes = comoTexto(actuales);
  const ahora = comoTexto(nuevas);

  let indice = antes ? hoja.datos.entries.findIndex((l) => l.treatedZone === antes) : -1;
  if (indice === -1) {
    indice = hoja.datos.entries.findIndex((l) => !l.treatedZone?.trim());
  }
  if (indice === -1) return;

  hoja.onCambioLinea(indice, { treatedZone: ahora });
}

/* -------------------------------------------------------------------------
 * Piezas comunes
 * ---------------------------------------------------------------------- */

/**
 * Campo escribible en la hoja, sin caja propia.
 *
 * Es un `input` transparente sobre la línea del papel: el fondo solo aparece
 * al enfocarlo, que es lo que indica dónde se está escribiendo sin llenar la
 * hoja de recuadros.
 */
function CampoHoja({
  valor,
  onEscribir,
  editable,
  ancho = '',
  clase = '',
}: {
  valor: string;
  onEscribir: (v: string) => void;
  editable: boolean;
  ancho?: string;
  clase?: string;
}) {
  if (!editable) {
    return <span className={`${SUBRAYADO} ${ancho} ${clase}`}>{valor}</span>;
  }
  return (
    <span className={`${SUBRAYADO} ${ancho} p-0`}>
      <input
        value={valor}
        onChange={(evento) => onEscribir(evento.target.value)}
        className={`w-full bg-transparent px-1 py-0.5 text-[10px] outline-none transition-colors focus:bg-brand-50 ${clase}`}
      />
    </span>
  );
}

/** Casilla de verificación con la pinta de la del papel. */
function Casilla({
  activa,
  onAlternar,
  etiqueta,
  editable,
  grande = false,
}: {
  activa: boolean;
  onAlternar: () => void;
  etiqueta: string;
  editable: boolean;
  /** En la columna apilada el objetivo tiene que aceptar un dedo. */
  grande?: boolean;
}) {
  const caja = grande
    ? 'flex h-5 w-5 shrink-0 items-center justify-center border-2 border-brand-700 text-sm font-black leading-none text-bad'
    : MARCA;
  const contenido = <span className={caja}>{activa ? '×' : ''}</span>;

  if (!editable) {
    return (
      <span className={`flex shrink-0 items-center gap-1 ${grande ? 'text-sm' : 'text-[9px]'}`}>
        {contenido}
        {etiqueta}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-pressed={activa}
      className={`flex shrink-0 items-center rounded transition-colors hover:bg-brand-50 ${
        grande ? 'min-h-11 gap-2 px-2 text-sm' : 'gap-1 px-0.5 text-[9px]'
      }`}
    >
      {contenido}
      {etiqueta}
    </button>
  );
}

function BloqueTipoPaciente({ hoja, grande = false }: { hoja: Hoja; grande?: boolean }) {
  return (
    <>
      {!grande && <span className={PASTILLA}>Tipo de paciente</span>}
      {TIPOS_ATENCION.map((opcion) => (
        <Casilla
          key={opcion.id}
          activa={hoja.datos.careType === opcion.id}
          // Es excluyente: marcar uno apaga el otro, no se alterna.
          onAlternar={() => hoja.onCambio?.({ careType: opcion.id })}
          etiqueta={opcion.etiqueta}
          editable={hoja.editable}
          grande={grande}
        />
      ))}
    </>
  );
}

function BloqueTrasplante({ hoja, grande = false }: { hoja: Hoja; grande?: boolean }) {
  const { datos, editable, onCambio } = hoja;

  return (
    <>
      {!grande && <span className={PASTILLA}>Trasplante</span>}
      <Casilla
        activa={datos.transplantBeard}
        onAlternar={() => onCambio?.({ transplantBeard: !datos.transplantBeard })}
        etiqueta="Barba"
        editable={editable}
        grande={grande}
      />
      <Casilla
        activa={datos.transplantEyebrows}
        onAlternar={() => onCambio?.({ transplantEyebrows: !datos.transplantEyebrows })}
        etiqueta="Cejas"
        editable={editable}
        grande={grande}
      />
      <Casilla
        activa={datos.transplantScalp}
        onAlternar={() => onCambio?.({ transplantScalp: !datos.transplantScalp })}
        etiqueta="Capilar"
        editable={editable}
        grande={grande}
      />
      <span className={`shrink-0 ${grande ? 'text-sm' : 'text-[9px]'}`}>zonas</span>
      {[1, 2, 3, 4].map((zona) => (
        <Casilla
          key={zona}
          activa={datos.transplantZones.includes(zona)}
          onAlternar={() => alternarZonaTrasplante(hoja, zona)}
          etiqueta={String(zona)}
          editable={editable}
          grande={grande}
        />
      ))}
    </>
  );
}

function BotonFirma({
  firma,
  onFirmar,
  editable,
  compacto,
}: {
  firma: string | null | undefined;
  onFirmar: () => void;
  editable: boolean;
  /** En la celda de la tabla; si no, en la tarjeta de la sesión. */
  compacto: boolean;
}) {
  const imagen = firma ? (
    /* eslint-disable-next-line @next/next/no-img-element -- data URL embebido */
    <img src={firma} alt="" className={compacto ? 'max-h-8 object-contain' : 'max-h-12 object-contain'} />
  ) : null;

  if (!editable) {
    return compacto ? (
      imagen
    ) : (
      <div className="flex min-h-14 items-center justify-center rounded-xl border border-line bg-white">
        {imagen ?? <span className="text-sm text-muted">Sin firma</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onFirmar}
      className={
        compacto
          ? 'flex h-full w-full items-center justify-center rounded transition-colors hover:bg-brand-50'
          : 'flex min-h-14 w-full items-center justify-center rounded-xl border border-dashed border-line bg-white transition-colors hover:bg-brand-50'
      }
    >
      {imagen ?? (
        <span className={compacto ? 'text-[7px] text-warn' : 'text-sm text-warn'}>
          Firmar
        </span>
      )}
    </button>
  );
}

/* -------------------------------------------------------------------------
 * Disposición hoja (la del papel)
 * ---------------------------------------------------------------------- */

function FilaCabecera({ hoja, fila }: { hoja: Hoja; fila: number }) {
  const { datos, editable } = hoja;
  const { dia, mes, anio } = partesFecha(claveFecha(datos.procedureDate));

  return (
    <div className="flex items-end gap-x-2 gap-y-1">
      {CAMPOS_CABECERA.filter((campo) => campo.fila === fila).map((campo, indice) => {
        if ('bloque' in campo) {
          return campo.bloque === 'tipoPaciente' ? (
            <BloqueTipoPaciente key={indice} hoja={hoja} />
          ) : (
            <BloqueTrasplante key={indice} hoja={hoja} />
          );
        }

        /**
         * `ancho` mide el espacio de escribir, no el grupo entero. El grupo se
         * ajusta a su contenido —píldora + hueco— salvo cuando el campo pide
         * crecer, que entonces es él quien reparte lo que sobra en la fila.
         */
        const flexible = campo.ancho.includes('flex-1');

        return (
          <span
            key={campo.clave}
            className={`flex items-end gap-1.5 ${flexible ? 'min-w-0 flex-1' : 'shrink-0'}`}
          >
            <span className={PASTILLA}>{campo.etiqueta}</span>

            {campo.tipo === 'fecha' && !editable ? (
              <span className="flex shrink-0 gap-0.5 tabular-nums">
                {[dia, mes, anio.slice(2)].map((parte, i) => (
                  <span
                    key={i}
                    className="w-6 border border-brand-700 px-0.5 py-0.5 text-center text-[9px]"
                  >
                    {parte}
                  </span>
                ))}
              </span>
            ) : campo.tipo === 'fecha' ? (
              <input
                type="date"
                value={valorDe(hoja, campo)}
                onChange={(evento) => escribirEn(hoja, campo, evento.target.value)}
                aria-label={campo.etiqueta}
                className="shrink-0 rounded border border-brand-700 px-1 py-0.5 text-[10px] outline-none focus:bg-brand-50"
              />
            ) : campo.clave === 'patientName' && editable && hoja.onElegirPaciente ? (
              <NombrePacienteHoja
                valor={valorDe(hoja, campo)}
                onEscribir={(v) => escribirEn(hoja, campo, v)}
                onElegir={hoja.onElegirPaciente}
                vinculado={Boolean(hoja.pacienteVinculado)}
                claseContenedor={`${SUBRAYADO} min-w-0 flex-1 p-0`}
                claseInput="w-full bg-transparent px-1 py-0.5 text-[10px] outline-none transition-colors placeholder:text-brand-700/35 focus:bg-brand-50"
              />
            ) : (
              <CampoHoja
                valor={valorDe(hoja, campo)}
                onEscribir={(v) => escribirEn(hoja, campo, v)}
                editable={editable}
                ancho={flexible ? 'min-w-0 flex-1' : campo.ancho}
                clase={
                  ('numerico' in campo && campo.numerico) || campo.tipo === 'numero'
                    ? 'tabular-nums'
                    : ''
                }
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

/**
 * La celda de «Próximo control» lleva además la hora y el tratamiento.
 *
 * Van DENTRO de esa celda y no en columnas nuevas para no romper el parecido
 * con el papel: son datos de la agenda, no del talonario. Solo aparecen al
 * llenar; impreso queda la fecha sola, como en la hoja original.
 */
function ExtrasProximoControl({ hoja, indice }: { hoja: Hoja; indice: number }) {
  const linea = hoja.datos.entries[indice];
  const cita = linea.nextControlAppointment;

  if (!hoja.editable) {
    if (!cita || cita.status === 'CANCELADA') return null;
    return <span className="mt-0.5 block text-[6.5px] text-brand-700">Cita agendada</span>;
  }

  if (!linea.nextControl) return null;

  return (
    <div className="mt-1 space-y-1 border-t border-brand-700/30 pt-1">
      {/* El tratamiento va PRIMERO: de él sale la duración, y sin duración no
          hay huecos que ofrecer. */}
      <SelectorTratamiento
        value={linea.nextControlServiceId ?? ''}
        onChange={(serviceId) =>
          hoja.onCambioLinea?.(indice, { nextControlServiceId: serviceId || null })
        }
        servicios={hoja.servicios}
        onCreado={(servicio) => hoja.onNuevoTratamiento?.(servicio)}
        placeholder="Tratamiento…"
        className="w-full bg-transparent text-[9px] outline-none focus:bg-brand-50"
      />
      <SelectorHoraControl
        fecha={linea.nextControl}
        serviceId={linea.nextControlServiceId}
        valor={linea.nextControlTime}
        onCambiar={(hora) => hoja.onCambioLinea?.(indice, { nextControlTime: hora })}
        etiqueta={`Hora del próximo control de la sesión ${indice + 1}`}
        className="w-full bg-transparent text-[9px] outline-none focus:bg-brand-50"
      />
      {cita && cita.status !== 'CANCELADA' && (
        <p className="text-[7px] text-brand-700">✓ Agendada</p>
      )}
    </div>
  );
}

/**
 * De dónde salen las sugerencias de cada columna.
 *
 * Se usa un `<datalist>` y no un desplegable cerrado a propósito: en la hoja
 * de papel estas casillas son texto libre —«Meso + PRP», «Minoxidil 5 % noche»—
 * y encerrarlas en una lista obligaría a inventar una opción «otro» y a
 * escribirla igual. Así se ofrece lo que ya está registrado y se puede seguir
 * escribiendo cualquier cosa.
 */
const LISTAS: Partial<Record<keyof LineaControl, string>> = {
  treatment: 'sug-tratamientos',
  treatedZone: 'sug-zonas',
  oralMedication: 'sug-insumos',
  topicalMedication: 'sug-insumos',
  shampoo: 'sug-insumos',
};

function ListasDeSugerencias({ hoja }: { hoja: Hoja }) {
  if (!hoja.editable) return null;

  // Las zonas ya marcadas en los diagramas, juntas, como primera opción: es el
  // caso normal —se pintan las cabezas y esa misma zona es la que se trató—.
  const marcadas = hoja.datos.markedZones.map((zona) => etiquetaZona(zona));
  const zonas = [...(marcadas.length > 1 ? [marcadas.join(' · ')] : []), ...SUGERENCIAS_ZONA];

  return (
    <>
      <datalist id="sug-tratamientos">
        {hoja.servicios.map((servicio) => (
          <option key={servicio.id} value={servicio.name} />
        ))}
      </datalist>
      <datalist id="sug-zonas">
        {zonas.map((zona) => (
          <option key={zona} value={zona} />
        ))}
      </datalist>
      <datalist id="sug-insumos">
        {hoja.productos.map((producto) => (
          <option key={producto} value={producto} />
        ))}
      </datalist>
    </>
  );
}

/**
 * Trae a «Zona tratada» lo que esté marcado en los diagramas de cabeza.
 *
 * Es un botón y no un automatismo a propósito. Las cabezas marcan las zonas
 * AFECTADAS de toda la ficha —el diagnóstico— y la columna dice qué se trató
 * EN ESA SESIÓN, que muchas veces es solo una parte. Copiarlo solo al pulsar
 * evita que marcar una zona nueva reescriba, calladamente, lo que ya se había
 * anotado en las sesiones anteriores.
 */
function ZonasMarcadas({
  hoja,
  indice,
  pequeno,
}: {
  hoja: Hoja;
  indice: number;
  pequeno: boolean;
}) {
  const marcadas = hoja.datos.markedZones;
  if (!hoja.editable || marcadas.length === 0) return null;

  const texto = marcadas.map((zona) => etiquetaZona(zona)).join(' · ');
  if (hoja.datos.entries[indice]?.treatedZone === texto) return null;

  return (
    <button
      type="button"
      /* La celda entera abre el campo de escritura al pulsarla; este botón
         vive dentro de ella y tiene que hacer lo suyo, no las dos cosas. */
      onMouseDown={(evento) => evento.stopPropagation()}
      onClick={() => hoja.onCambioLinea?.(indice, { treatedZone: texto })}
      title={`Usar las zonas marcadas en los diagramas: ${texto}`}
      className={
        pequeno
          ? // Sin `truncate`: es la lista de zonas y cortarla deja al que llena
            // la ficha adivinando cuáles va a copiar el botón.
            'block w-full px-1.5 pb-1 text-left text-[7px] leading-tight text-brand-700 underline underline-offset-1'
          : 'mt-2 inline-flex min-h-11 items-center rounded-xl border border-line px-3 py-2 text-left text-sm text-brand-700'
      }
    >
      ↧ {pequeno ? texto : `Usar las zonas de los diagramas (${texto})`}
    </button>
  );
}

function CeldaTexto({
  hoja,
  indice,
  clave,
}: {
  hoja: Hoja;
  indice: number;
  clave: keyof LineaControl;
}) {
  const bruto = hoja.datos.entries[indice][clave];
  const valor = typeof bruto === 'string' ? bruto : '';
  const fecha = esFecha(clave);
  const mostrado = fecha && valor ? claveFecha(valor) : valor;
  const esProximo = clave === 'nextControl';

  /**
   * La casilla muestra el texto entero; solo se vuelve campo al escribir en ella.
   *
   * Las columnas miden entre el 6 % y el 13 % del ancho de la hoja, y un
   * `input` no parte el texto en varias líneas: lo que no cabe deja de verse,
   * y no hay estilo que lo arregle —el elemento no sabe hacerlo—. Antes se
   * repetía el texto debajo, pero entonces TODAS las casillas llenas quedaban
   * duplicadas a la vez y la fila era ilegible.
   *
   * Así solo hay un campo en pantalla, el de la casilla en la que se está
   * escribiendo. Las demás muestran lo anotado, completo y en varias líneas,
   * como en la hoja de papel. Se sigue usando un `input` al escribir para no
   * perder las sugerencias del `datalist`, que un `textarea` no admite.
   */
  const [escribiendo, setEscribiendo] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const [desborda, setDesborda] = useState(false);

  useEffect(() => {
    if (!escribiendo) return undefined;

    function revisar() {
      const el = campo.current;
      // El +1 evita que un redondeo de medio píxel encienda el eco solo.
      if (el) setDesborda(el.scrollWidth > el.clientWidth + 1);
    }

    revisar();
    window.addEventListener('resize', revisar);
    return () => window.removeEventListener('resize', revisar);
  }, [escribiendo, mostrado]);

  if (!hoja.editable) {
    return (
      <td className={`${CELDA} break-words ${fecha ? 'tabular-nums' : ''}`}>
        {mostrado}
        {esProximo && <ExtrasProximoControl hoja={hoja} indice={indice} />}
      </td>
    );
  }

  // Las fechas se quedan siempre como campo: el calendario del navegador es lo
  // que las hace cómodas, y una fecha nunca desborda su casilla.
  if (fecha) {
    return (
      <td className={`${CELDA} ${esProximo ? 'px-1.5 py-1' : 'p-0'}`}>
        <input
          type="date"
          value={mostrado}
          onChange={(evento) =>
            hoja.onCambioLinea?.(indice, {
              [clave]: evento.target.value || null,
            } as Partial<LineaControl>)
          }
          className={`w-full bg-transparent text-[9px] outline-none transition-colors focus:bg-brand-50 ${
            esProximo ? '' : 'px-1.5 py-1.5'
          }`}
        />
        {esProximo && <ExtrasProximoControl hoja={hoja} indice={indice} />}
      </td>
    );
  }

  return (
    /*
      La casilla ENTERA es el sitio donde se pulsa para escribir, no solo el
      renglón del texto.

      Las filas crecen a la altura de la casilla más larga: si en «Tratamiento»
      hay tres renglones, la de al lado mide lo mismo aunque esté vacía. Con el
      manejador solo en el texto, ese hueco de abajo no respondía y había que
      subir el mouse hasta el primer renglón para poder escribir.

      Va en la celda y no en un `div` estirado porque una celda de tabla no le
      pasa su altura a los hijos de forma fiable entre navegadores; el evento,
      en cambio, funciona igual en todos.
    */
    <td
      className={`${CELDA} p-0 ${escribiendo ? '' : 'cursor-text'}`}
      onMouseDown={
        escribiendo
          ? undefined
          : (evento) => {
              evento.preventDefault();
              setEscribiendo(true);
            }
      }
    >
      {escribiendo ? (
        <>
          {/* `autoFocus` aquí es correcto: el campo acaba de aparecer porque
              la persona pulsó justo en esta casilla. */}
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            ref={campo}
            autoFocus
            type="text"
            list={LISTAS[clave]}
            value={mostrado}
            onChange={(evento) =>
              hoja.onCambioLinea?.(indice, {
                [clave]: evento.target.value || null,
              } as Partial<LineaControl>)
            }
            onBlur={() => setEscribiendo(false)}
            className="w-full bg-brand-50 px-1.5 py-1.5 text-[9px] outline-none"
          />

          {/* Mientras se escribe, y SOLO si no cabe en el campo, lo tecleado se
              lee entero debajo. Es la única casilla duplicada en la hoja. */}
          {desborda && (
            <p className="break-words px-1.5 pb-1 text-[7.5px] leading-tight text-ink/70">
              {mostrado}
            </p>
          )}
        </>
      ) : (
        /*
          El `preventDefault` del `mousedown` de la celda es lo que hace que
          esto funcione: sin él el navegador enfoca este `div` justo antes de
          que desaparezca, y el `input` recién montado pierde el foco en el
          mismo gesto. `tabIndex` y `onFocus` se quedan para el teclado.
        */
        <div
          role="textbox"
          tabIndex={0}
          aria-label={String(clave)}
          onFocus={() => setEscribiendo(true)}
          className="min-h-[1.9em] w-full whitespace-pre-wrap break-words px-1.5 py-1.5 text-[9px] leading-tight outline-none focus:bg-brand-50"
        >
          {mostrado}
        </div>
      )}

      {clave === 'treatedZone' && <ZonasMarcadas hoja={hoja} indice={indice} pequeno />}
    </td>
  );
}

/* -------------------------------------------------------------------------
 * Disposición apilada (celular y tablet en vertical)
 * ---------------------------------------------------------------------- */

/**
 * Campo a ancho completo, con su etiqueta encima.
 *
 * El texto va a 16 px como mínimo: por debajo de eso, Safari en iPhone hace
 * zoom automático al enfocar el campo y descoloca toda la pantalla.
 */
function CampoApilado({ hoja, campo }: { hoja: Hoja; campo: CampoSimple }) {
  const valor = valorDe(hoja, campo);
  const id = `campo-${campo.clave}`;

  return (
    <div>
      <label htmlFor={id} className={ETIQUETA_APILADA}>
        {campo.etiqueta}
      </label>
      {hoja.editable && campo.clave === 'patientName' && hoja.onElegirPaciente ? (
        // La búsqueda tiene que estar en las DOS disposiciones. Al moverla al
        // campo NOMBRE se cableó solo en la hoja ancha, y en el celular —que es
        // justo donde se agenda a la carrera— el nombre volvía a ser un campo
        // mudo.
        <NombrePacienteHoja
          valor={valor}
          onEscribir={(v) => escribirEn(hoja, campo, v)}
          onElegir={hoja.onElegirPaciente}
          vinculado={Boolean(hoja.pacienteVinculado)}
          claseContenedor="block"
          claseInput={`${CAMPO_APILADO} py-2.5`}
        />
      ) : hoja.editable ? (
        <input
          id={id}
          type={campo.tipo === 'fecha' ? 'date' : 'text'}
          inputMode={campo.tipo === 'numero' ? 'numeric' : undefined}
          value={valor}
          onChange={(evento) => escribirEn(hoja, campo, evento.target.value)}
          className={CAMPO_APILADO}
        />
      ) : (
        <p className={LECTURA_APILADA}>{valor || '—'}</p>
      )}
    </div>
  );
}

function CabeceraApilada({ hoja }: { hoja: Hoja }) {
  const campos = CAMPOS_CABECERA.filter((campo): campo is CampoSimple => 'clave' in campo);

  return (
    <section className="rounded-2xl border border-brand-700/40 p-4">
      <h2 className="mb-4 text-center text-sm font-bold uppercase tracking-wide text-brand-800">
        Datos del paciente
      </h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {campos.map((campo) => (
          <CampoApilado key={campo.clave} hoja={hoja} campo={campo} />
        ))}
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <p className={ETIQUETA_APILADA}>Tipo de paciente</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <BloqueTipoPaciente hoja={hoja} grande />
          </div>
        </div>
        <div>
          <p className={ETIQUETA_APILADA}>Trasplante</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <BloqueTrasplante hoja={hoja} grande />
          </div>
        </div>
      </div>

      <div className="mt-5 border-t border-brand-700/30 pt-4">
        <p className={ETIQUETA_APILADA}>Zonas afectadas</p>
        <DiagramaCabeza
          marcadas={hoja.datos.markedZones}
          compacto
          chipsGrandes
          onAlternar={hoja.editable ? (zona) => alternarZonaMarcada(hoja, zona) : undefined}
        />
      </div>
    </section>
  );
}

function SesionApilada({
  hoja,
  indice,
  desplegada,
  onAlternar,
}: {
  hoja: Hoja;
  indice: number;
  desplegada: boolean;
  onAlternar: () => void;
}) {
  const { datos, editable } = hoja;
  const entrada = datos.entries[indice];
  const fecha = entrada.sessionDate ? claveFecha(entrada.sessionDate) : 'Sin fecha';

  return (
    <article className="overflow-hidden rounded-2xl border border-brand-700/40">
      <div className="flex items-center bg-brand-50">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={desplegada}
          className="flex min-h-12 flex-1 items-center gap-3 px-4 text-left"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-brand-700 transition-transform ${
              desplegada ? 'rotate-180' : ''
            }`}
            strokeWidth={2}
            aria-hidden
          />
          <span className="text-sm font-semibold text-brand-800">
            Sesión {indice + 1}
            {entrada.controlLabel ? ` · ${entrada.controlLabel}` : ''}
          </span>
          <span className="ml-auto text-xs tabular-nums text-muted">{fecha}</span>
        </button>

        {editable && (
          <button
            type="button"
            onClick={() => hoja.onQuitarLinea?.(indice)}
            disabled={datos.entries.length === 1}
            className="mr-2 rounded-lg p-2.5 text-muted transition-colors hover:bg-bad-bg hover:text-bad disabled:pointer-events-none disabled:opacity-30"
            aria-label={`Quitar la sesión ${indice + 1}`}
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          </button>
        )}
      </div>

      {desplegada && (
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          {COLUMNAS.map((columna) => {
            const bruto = entrada[columna.clave];
            const valor = typeof bruto === 'string' ? bruto : '';
            const fechaCampo = esFecha(columna.clave);
            const mostrado = fechaCampo && valor ? claveFecha(valor) : valor;
            const id = `sesion-${indice}-${columna.clave}`;

            return (
              <div key={columna.clave}>
                <label htmlFor={id} className={ETIQUETA_APILADA}>
                  {columna.titulo}
                  {'detalle' in columna && columna.detalle && (
                    <span className="block text-[10px] font-normal normal-case text-muted">
                      {columna.detalle}
                    </span>
                  )}
                </label>
                {editable ? (
                  <input
                    id={id}
                    type={fechaCampo ? 'date' : 'text'}
                    list={LISTAS[columna.clave]}
                    value={mostrado}
                    onChange={(evento) =>
                      hoja.onCambioLinea?.(indice, {
                        [columna.clave]: evento.target.value || null,
                      } as Partial<LineaControl>)
                    }
                    className={CAMPO_APILADO}
                  />
                ) : (
                  <p className={LECTURA_APILADA}>{mostrado || '—'}</p>
                )}

                {/*
                  Lo mismo que en la hoja ancha: el campo no parte el texto en
                  varias líneas y lo que no cabe deja de verse.

                  Aquí el campo ocupa el ancho de la pantalla, así que en vez de
                  medir el desborde basta con el largo: por debajo de unos 38
                  caracteres entra sin problema en un celular, y repetirlo sería
                  ruido. El caso que de verdad se sale es la lista de zonas.
                */}
                {editable && mostrado.trim().length > 38 && (
                  <p className="mt-1.5 text-sm leading-snug text-ink/70">{mostrado}</p>
                )}

                {columna.clave === 'treatedZone' && (
                  <ZonasMarcadas hoja={hoja} indice={indice} pequeno={false} />
                )}

                {columna.clave === 'nextControl' && entrada.nextControl && (
                  <div className="mt-3 space-y-3">
                    {/* El tratamiento primero: de él sale la duración, y sin
                        duración no hay horarios libres que ofrecer. */}
                    <div>
                      <label htmlFor={`${id}-trat`} className={ETIQUETA_APILADA}>
                        Tratamiento del control
                      </label>
                      {editable ? (
                        <SelectorTratamiento
                          id={`${id}-trat`}
                          value={entrada.nextControlServiceId ?? ''}
                          onChange={(serviceId) =>
                            hoja.onCambioLinea?.(indice, {
                              nextControlServiceId: serviceId || null,
                            })
                          }
                          servicios={hoja.servicios}
                          onCreado={(servicio) => hoja.onNuevoTratamiento?.(servicio)}
                          placeholder="Selecciona…"
                          className={CAMPO_APILADO}
                        />
                      ) : (
                        <p className={LECTURA_APILADA}>
                          {hoja.servicios.find((s) => s.id === entrada.nextControlServiceId)?.name ??
                            '—'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor={`${id}-hora`} className={ETIQUETA_APILADA}>
                        Hora del control
                      </label>
                      {editable ? (
                        <SelectorHoraControl
                          fecha={entrada.nextControl}
                          serviceId={entrada.nextControlServiceId}
                          valor={entrada.nextControlTime}
                          onCambiar={(hora) =>
                            hoja.onCambioLinea?.(indice, { nextControlTime: hora })
                          }
                          etiqueta="Hora del control"
                          className={CAMPO_APILADO}
                        />
                      ) : (
                        <p className={LECTURA_APILADA}>{entrada.nextControlTime || '—'}</p>
                      )}
                    </div>
                    {entrada.nextControlAppointment &&
                      entrada.nextControlAppointment.status !== 'CANCELADA' && (
                        <p className="text-sm text-brand-700">✓ Cita agendada en la agenda</p>
                      )}
                  </div>
                )}
              </div>
            );
          })}

          {(['professional', 'patient'] as const).map((quien) => (
            <div key={quien}>
              <p className={ETIQUETA_APILADA}>
                {quien === 'professional' ? 'Firma profesional' : 'Firma paciente'}
              </p>
              <BotonFirma
                firma={
                  quien === 'professional' ? entrada.professionalSignature : entrada.patientSignature
                }
                onFirmar={() => hoja.onFirmar?.(indice, quien)}
                editable={editable}
                compacto={false}
              />
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------
 * Componente principal
 * ---------------------------------------------------------------------- */

interface Props {
  datos: DatosHoja;
  /** Catálogo de tratamientos, para agendar el próximo control. */
  servicios?: Service[];
  onNuevoTratamiento?: (servicio: Service) => void;
  /** Sin esto la hoja es solo lectura y es lo que se imprime. */
  editable?: boolean;
  /** `auto` mide el espacio disponible. Forzar sirve para la vista previa. */
  disposicion?: 'auto' | 'hoja' | 'apilada';
  onCambio?: (parche: Partial<DatosHoja>) => void;
  onCambioLinea?: (indice: number, parche: Partial<LineaControl>) => void;
  onAgregarLinea?: () => void;
  /** Agrega una sesión con el tratamiento de la anterior ya copiado. */
  onRepetirLinea?: () => void;
  onQuitarLinea?: (indice: number) => void;
  onFirmar?: (indice: number, quien: Quien) => void;
  /** Ficha de la historia detrás del nombre, si ya se eligió una. */
  pacienteVinculado?: boolean;
  /** Se eligió un paciente desde el propio campo NOMBRE. */
  onElegirPaciente?: (paciente: PacienteEncontrado) => void;
  /** Nombres de lo que hay en inventario, para sugerir la medicación. */
  productos?: string[];
}

export function FichaHoja({
  datos,
  servicios = [],
  onNuevoTratamiento,
  editable = false,
  disposicion = 'auto',
  onCambio,
  onCambioLinea,
  onAgregarLinea,
  onRepetirLinea,
  onQuitarLinea,
  onFirmar,
  pacienteVinculado,
  onElegirPaciente,
  productos = [],
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState<number | null>(null);
  const [tactil, setTactil] = useState(false);
  const [abierta, setAbierta] = useState<number>(datos.entries.length - 1);

  /**
   * Ancho real del CONTENEDOR, que no es el de la ventana.
   *
   * La primera medida se toma a mano y no se espera al observador: hasta que
   * este dispara, `ancho` es null y con null no se apila, así que la hoja ancha
   * alcanzaba a pintarse un instante en un teléfono antes de recolocarse.
   */
  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo || disposicion !== 'auto') return;

    const observador = new ResizeObserver(([entrada]) => setAncho(entrada.contentRect.width));
    observador.observe(nodo);
    setAncho(nodo.getBoundingClientRect().width);

    return () => observador.disconnect();
  }, [disposicion]);

  /**
   * ¿Se maneja con el dedo o con mouse?
   *
   * Es lo que de verdad decide la disposición, no el ancho. Medido: en el
   * panel la barra lateral se lleva 256 px, así que un portátil de 1366 deja
   * 1010 para la hoja y uno de 1440 deja 1084 — los dos por debajo del umbral.
   * Decidiendo solo por ancho, la ficha se apilaba EN EL COMPUTADOR, que es
   * justo donde tiene que verse como el papel.
   */
  useEffect(() => {
    const consulta = window.matchMedia('(pointer: coarse)');
    const aplicar = () => setTactil(consulta.matches);
    aplicar();
    consulta.addEventListener('change', aplicar);
    return () => consulta.removeEventListener('change', aplicar);
  }, []);

  /**
   * Con mouse, SIEMPRE la hoja: si la ventana es angosta, se desplaza de lado
   * dentro de su recuadro, que con mouse es una molestia menor. Solo se apila
   * en pantallas táctiles sin espacio, donde arrastrar de lado sí hace la
   * ficha inservible.
   */
  /**
   * Dos motivos para apilar, y el primero no admite discusión.
   *
   * 1. NO CABE. Por debajo de 944 px la hoja no entra ni encogida al mínimo
   *    legible, así que dibujarla solo da un documento recortado. Da igual si
   *    la pantalla es táctil: un teléfono es un teléfono con dedo o con ratón.
   * 2. SE MANEJA CON EL DEDO y va justa. Ahí se prefiere la columna aunque la
   *    hoja cupiera, porque apuntar a una casilla de 9 px con el dedo no es
   *    rellenar una ficha, es pelearse con ella.
   */
  const apilada =
    disposicion === 'apilada' ||
    (disposicion === 'auto' &&
      ancho !== null &&
      (ancho < ANCHO_MINIMO_SIN_APILAR || (tactil && ancho < ANCHO_MINIMO_HOJA)));

  const hoja: Hoja = {
    datos,
    editable,
    servicios,
    onNuevoTratamiento,
    onCambio,
    onCambioLinea,
    onQuitarLinea,
    onFirmar,
    pacienteVinculado,
    onElegirPaciente,
    productos,
  };
  const vacias = editable ? 0 : Math.max(0, FILAS_MINIMAS - datos.entries.length);

  /**
   * La hoja se encoge para caber entera en pantallas de computador angostas.
   *
   * La hoja editable mide 1180 px. En el panel la barra lateral se lleva 256,
   * así que un portátil de 1366 deja 1010: sin esto habría que arrastrar de
   * lado para ver los diagramas y las columnas de firma, y la gracia de la
   * hoja es verla completa, como el papel.
   *
   * El tope de 0.8 es donde la letra deja de leerse; por debajo se prefiere
   * que sobre un poco de desplazamiento antes que volverla ilegible.
   */
  const escala =
    apilada || !editable || ancho === null
      ? 1
      : Math.min(1, Math.max(ESCALA_MINIMA_HOJA, ancho / ANCHO_HOJA_EDITABLE));

  return (
    <div ref={contenedor}>
      <style>{`@page { size: letter landscape; margin: 8mm; }`}</style>
      <ListasDeSugerencias hoja={hoja} />

      {apilada ? (
        <article className="hoja mx-auto w-full max-w-3xl space-y-4 bg-white p-4 text-ink">
          <CabeceraApilada hoja={hoja} />

          <section>
            <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-wide text-brand-800">
              {TITULO_TABLA}
            </h2>

            <div className="space-y-3">
              {datos.entries.map((_, indice) => (
                <SesionApilada
                  key={indice}
                  hoja={hoja}
                  indice={indice}
                  desplegada={abierta === indice}
                  onAlternar={() => setAbierta(abierta === indice ? -1 : indice)}
                />
              ))}
            </div>

            {editable && (
              <div className="mt-3 space-y-2">
                {/*
                  Repetir va PRIMERO y en verde lleno porque es lo que se hace
                  casi siempre: entre una sesión y la otra el tratamiento no
                  cambia. Copiar solo el plan —diagnóstico, tratamiento, zona,
                  medicación—; los hallazgos y el próximo control se dejan en
                  blanco a propósito, que son de ese día y de nadie más.
                */}
                {datos.entries.length > 0 && onRepetirLinea && (
                  <button
                    type="button"
                    onClick={() => {
                      onRepetirLinea();
                      setAbierta(datos.entries.length);
                    }}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-700 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
                  >
                    <CopyPlus className="h-4 w-4" strokeWidth={2} aria-hidden />
                    Repetir la sesión anterior
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onAgregarLinea?.();
                    // La sesión nueva se abre sola: si no, hay que buscarla y
                    // tocarla, que es un paso de más en el peor momento.
                    setAbierta(datos.entries.length);
                  }}
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-brand-700 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-50"
                >
                  <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Agregar sesión en blanco
                </button>
              </div>
            )}
          </section>

          {(editable || datos.notes) && (
            <section className="rounded-2xl border border-brand-700/40 p-4">
              <label htmlFor="notas-ficha" className={ETIQUETA_APILADA}>
                Observaciones
              </label>
              {editable ? (
                <textarea
                  id="notas-ficha"
                  rows={3}
                  value={datos.notes ?? ''}
                  onChange={(evento) => onCambio?.({ notes: evento.target.value || null })}
                  className="w-full resize-y rounded-xl border border-line bg-white px-3 py-2.5 text-base outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-400/25"
                />
              ) : (
                <p className="whitespace-pre-line text-base">{datos.notes}</p>
              )}
            </section>
          )}

          <p className="text-center text-[9px] text-ink/60">
            {[SITE.name, LEGAL.nit].filter(Boolean).join(' · ')}
          </p>
        </article>
      ) : (
        <article
          // `zoom` y no `transform`: escalar con transform no cambia el alto
          // que ocupa el elemento y dejaría un hueco en blanco debajo.
          style={escala === 1 ? undefined : { zoom: escala }}
          className={`hoja mx-auto w-full bg-white p-6 text-ink ${
            editable ? 'min-w-[1180px]' : 'max-w-[263mm]'
          }`}
        >
          <h1 className="text-center text-[13px] font-bold uppercase tracking-wide text-brand-800">
            Datos del paciente
          </h1>

          <div className="mt-1.5 flex items-stretch gap-2 rounded-lg border border-brand-700 p-1.5">
            <div className="flex w-[92px] shrink-0 items-center justify-center border-r border-brand-700 pr-1.5">
              <Image src="/logo.png" alt="" width={200} height={71} className="h-auto w-full" priority />
            </div>

            {/* `min-w-0`: sin esto un nombre largo no encoge y empuja al resto
                fuera de la fila. */}
            <div className="min-w-0 flex-1 space-y-1">
              {FILAS_CABECERA.map((fila) => (
                <FilaCabecera key={fila} hoja={hoja} fila={fila} />
              ))}
            </div>

            <div className="w-[218px] shrink-0 border-l border-brand-700 pl-1.5">
              <DiagramaCabeza
                marcadas={datos.markedZones}
                compacto
                onAlternar={editable ? (zona) => alternarZonaMarcada(hoja, zona) : undefined}
              />
            </div>
          </div>

          <h2 className="mt-3 text-center text-[13px] font-bold uppercase tracking-wide text-brand-800">
            {TITULO_TABLA}
          </h2>

          <table className="mt-2 w-full table-fixed border-collapse">
            <thead>
              <tr className="bg-brand-700 text-white">
                {COLUMNAS.map((columna) => (
                  <th
                    key={columna.clave}
                    scope="col"
                    className={`${
                      editable && 'anchoEditable' in columna && columna.anchoEditable
                        ? columna.anchoEditable
                        : columna.ancho
                    } border border-brand-700 px-1 py-1 text-[8px] font-bold leading-tight`}
                  >
                    {columna.titulo}
                    {'detalle' in columna && columna.detalle && (
                      <span className="block text-[6px] font-normal">{columna.detalle}</span>
                    )}
                  </th>
                ))}
                <th scope="col" className="w-[7%] border border-brand-700 px-1 py-1 text-[8px] font-bold leading-tight">
                  Firma profesional
                </th>
                <th scope="col" className="w-[7%] border border-brand-700 px-1 py-1 text-[8px] font-bold leading-tight">
                  Firma paciente
                </th>
                {editable && (
                  <th scope="col" className="w-[3%] border border-brand-700 px-1 py-1">
                    <span className="sr-only">Quitar</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {datos.entries.map((entrada, indice) => (
                <tr key={indice}>
                  {COLUMNAS.map((columna) => (
                    <CeldaTexto key={columna.clave} hoja={hoja} indice={indice} clave={columna.clave} />
                  ))}

                  {(['professional', 'patient'] as const).map((quien) => (
                    <td key={quien} className={`${CELDA} h-10 text-center`}>
                      <BotonFirma
                        firma={
                          quien === 'professional'
                            ? entrada.professionalSignature
                            : entrada.patientSignature
                        }
                        onFirmar={() => onFirmar?.(indice, quien)}
                        editable={editable}
                        compacto
                      />
                    </td>
                  ))}

                  {editable && (
                    <td className={`${CELDA} text-center`}>
                      <button
                        type="button"
                        onClick={() => onQuitarLinea?.(indice)}
                        disabled={datos.entries.length === 1}
                        className="rounded p-1 text-muted transition-colors hover:bg-bad-bg hover:text-bad disabled:pointer-events-none disabled:opacity-30"
                        aria-label={`Quitar la sesión ${indice + 1}`}
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={1.8} aria-hidden />
                      </button>
                    </td>
                  )}
                </tr>
              ))}

              {Array.from({ length: vacias }).map((_, indice) => (
                <tr key={`vacia-${indice}`} aria-hidden>
                  {Array.from({ length: COLUMNAS.length + 2 }).map((__, columna) => (
                    <td key={columna} className={`${CELDA} h-9`}>
                      &nbsp;
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {editable && (
            <div className="no-imprimir mt-2 flex flex-wrap items-center gap-2">
              {datos.entries.length > 0 && onRepetirLinea && (
                <button
                  type="button"
                  onClick={onRepetirLinea}
                  title="Copia diagnóstico, tratamiento, zona y medicación de la última sesión. Los hallazgos quedan en blanco."
                  className="flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-[10px] font-semibold text-white transition-colors hover:bg-brand-800"
                >
                  <CopyPlus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  Repetir la anterior
                </button>
              )}
              <button
                type="button"
                onClick={onAgregarLinea}
                className="flex items-center gap-1.5 rounded-lg border border-brand-700 px-3 py-1.5 text-[10px] font-semibold text-brand-800 transition-colors hover:bg-brand-50"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                Agregar en blanco
              </button>
            </div>
          )}

          {(editable || datos.notes) && (
            <div className="mt-2 rounded-md border border-brand-700/50 px-2 py-1">
              <p className="text-[7px] font-bold uppercase tracking-wide text-brand-700">
                Observaciones
              </p>
              {editable ? (
                <textarea
                  rows={2}
                  value={datos.notes ?? ''}
                  onChange={(evento) => onCambio?.({ notes: evento.target.value || null })}
                  aria-label="Observaciones"
                  className="mt-0.5 w-full resize-y bg-transparent text-[9px] outline-none transition-colors focus:bg-brand-50"
                />
              ) : (
                <p className="mt-0.5 whitespace-pre-line text-[9px]">{datos.notes}</p>
              )}
            </div>
          )}

          <p className="mt-2 text-right text-[7px] text-ink/60">
            {[SITE.name, LEGAL.nit, SITE.addressFallback].filter(Boolean).join(' · ')}
          </p>
        </article>
      )}
    </div>
  );
}
