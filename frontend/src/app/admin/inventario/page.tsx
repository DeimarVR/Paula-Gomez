'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
  CircleDollarSign,
  Download,
  Loader2,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Undo2,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { formatCop, formatDateShort, hoyEnClinica } from '@/lib/format';
import type { AdminUser } from '@/lib/types';
import { BuscadorPaciente } from '@/components/admin/BuscadorPaciente';

/**
 * Inventario de medicamentos e insumos.
 *
 * La existencia no se guarda en ningún campo: el servidor la calcula sumando
 * los movimientos. Aquí solo se muestra. La consecuencia práctica es que la
 * única forma de cambiar el stock es registrando un movimiento, y por eso el
 * botón de «Ajuste» existe: cuando el conteo real no coincide, se anota la
 * diferencia como un hecho más y queda quién la anotó y por qué.
 */

type Tipo = 'MEDICAMENTO' | 'INSUMO';
type TipoMov = 'ENTRADA' | 'SALIDA' | 'AJUSTE';
type Motivo =
  | 'COMPRA'
  | 'USO_EN_PACIENTE'
  | 'VENTA'
  | 'DEVOLUCION'
  | 'VENCIMIENTO'
  | 'DANO'
  | 'CONTEO'
  | 'CORRECCION'
  | 'OTRO';

const TIPOS: Record<Tipo, string> = { MEDICAMENTO: 'Medicamento', INSUMO: 'Insumo' };

const MOTIVOS: Record<Motivo, string> = {
  COMPRA: 'Compra',
  USO_EN_PACIENTE: 'Uso en paciente',
  VENTA: 'Venta',
  DEVOLUCION: 'Devolución',
  VENCIMIENTO: 'Vencimiento',
  DANO: 'Daño o rotura',
  CONTEO: 'Ajuste por conteo',
  CORRECCION: 'Corrección',
  OTRO: 'Otro',
};

/**
 * Qué motivos tienen sentido según el tipo de movimiento.
 *
 * VENTA entra como salida escrita a mano: este centro no factura desde el
 * sistema, así que la venta de un producto se anota aquí y nada más.
 */
const MOTIVOS_POR_TIPO: Record<TipoMov, Motivo[]> = {
  ENTRADA: ['COMPRA', 'DEVOLUCION', 'OTRO'],
  SALIDA: ['USO_EN_PACIENTE', 'VENTA', 'VENCIMIENTO', 'DANO', 'OTRO'],
  AJUSTE: ['CONTEO', 'OTRO'],
};

interface Producto {
  id: string;
  name: string;
  kind: Tipo;
  sku: string | null;
  unit: string;
  presentation: string | null;
  category: string | null;
  salePrice: number | null;
  supplier: string | null;
  minStock: number;
  notes: string | null;
  active: boolean;
  stock: number;
  bajo: boolean;
  movimientos: number;
  /** Del lote más próximo a vencer. `null` si nadie anotó ninguna fecha. */
  venceEl: string | null;
  vencido: boolean;
  porVencer: boolean;
}

interface PorVencer {
  id: string;
  lotNumber: string | null;
  expiresAt: string;
  quantity: number;
  product: { id: string; name: string; unit: string };
}

/** Un producto activo al que nadie le puso precio de venta. */
interface SinPrecio {
  id: string;
  name: string;
  unit: string;
}

interface Movimiento {
  id: string;
  type: TipoMov;
  reason: Motivo;
  quantity: number;
  occurredAt: string;
  lotNumber: string | null;
  unitCost: number | null;
  notes: string | null;
  product: { id: string; name: string; unit: string; kind: Tipo };
  patient: { id: string; fullName: string } | null;
  createdBy: { fullName: string } | null;
  /** Cuál corrige, si este es una corrección. */
  correctsId: string | null;
  /** Si alguien ya lo corrigió. Se pinta tachado y no se puede volver a tocar. */
  corregido?: boolean;
}

export default function InventarioPage() {
  const [items, setItems] = useState<Producto[]>([]);
  const [porVencer, setPorVencer] = useState<PorVencer[]>([]);
  const [sinPrecio, setSinPrecio] = useState<SinPrecio[]>([]);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [vista, setVista] = useState<'existencias' | 'movimientos'>('existencias');
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<Tipo | ''>('');
  const [soloBajos, setSoloBajos] = useState(false);
  const [soloPorVencer, setSoloPorVencer] = useState(false);
  /**
   * Alfabético para buscar UNO; por vencimiento para ver QUÉ hay que sacar del
   * estante antes de que se pierda. Son dos formas distintas de mirar la misma
   * lista y ninguna sirve para lo del otro.
   */
  const [orden, setOrden] = useState<'nombre' | 'vencimiento'>('nombre');
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<AdminUser | null>(null);

  const [nuevoProducto, setNuevoProducto] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [movimientoDe, setMovimientoDe] = useState<Producto | null>(null);
  const [verArchivados, setVerArchivados] = useState(false);

  /** Los filtros de la pantalla, tal como viajan a la API. */
  const filtros = useCallback(() => {
    const params = new URLSearchParams();
    if (busqueda) params.set('q', busqueda);
    if (filtroTipo) params.set('kind', filtroTipo);
    if (soloBajos) params.set('soloBajos', 'true');
    if (soloPorVencer) params.set('soloPorVencer', 'true');
    // La casilla enseña LOS archivados, no los archivados más todo lo demás.
    if (verArchivados) params.set('soloArchivados', 'true');
    if (orden !== 'nombre') params.set('orden', orden);
    return params;
  }, [busqueda, filtroTipo, soloBajos, soloPorVencer, verArchivados, orden]);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const params = filtros();

      const [inventario, movs] = await Promise.all([
        api.get<{ items: Producto[]; porVencer: PorVencer[]; sinPrecio: SinPrecio[] }>(
          `/api/inventario?${params}`,
        ),
        api.get<{ items: Movimiento[] }>('/api/inventario/movimientos?take=100'),
      ]);
      setItems(inventario.items);
      setPorVencer(inventario.porVencer);
      setSinPrecio(inventario.sinPrecio ?? []);
      setMovimientos(movs.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar el inventario');
    } finally {
      setCargando(false);
    }
  }, [filtros]);

  useEffect(() => {
    const temporizador = setTimeout(() => void cargar(), busqueda ? 400 : 0);
    return () => clearTimeout(temporizador);
  }, [cargar, busqueda]);

  /**
   * Baja el inventario en Excel con los filtros puestos.
   *
   * El archivo trae los archivados aunque la pantalla no los esté mostrando:
   * se usa para comparar listas, y ahí hace falta poder ver que un producto no
   * desapareció sino que alguien lo archivó.
   */
  async function descargar() {
    setDescargando(true);
    setError(null);
    try {
      await api.descargar(`/api/inventario/exportar?${filtros().toString()}`, 'Inventario.xlsx');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos generar el Excel');
    } finally {
      setDescargando(false);
    }
  }

  useEffect(() => {
    void api
      .get<{ user: AdminUser }>('/api/auth/me')
      .then((r) => setUsuario(r.user))
      .catch(() => setUsuario(null));
  }, []);

  /**
   * Borra el producto si nunca se movió; si tiene historial, lo archiva.
   *
   * La decisión la toma el servidor —es el único que sabe si hay
   * movimientos—, pero el aviso se escribe aquí con el contador que viene en
   * el listado, para que diga lo que va a pasar antes y no después.
   */
  async function borrarProducto(producto: Producto) {
    const mensaje =
      producto.movimientos > 0
        ? `«${producto.name}» tiene ${producto.movimientos} movimiento(s), así que NO se borra: se archiva y deja de aparecer en las listas. Su historial se conserva. ¿Continuar?`
        : `¿Borrar «${producto.name}»? Nunca se movió, así que se borra del todo.`;

    if (!window.confirm(mensaje)) return;

    try {
      const respuesta = await api.delete<{ borrado: boolean }>(`/api/inventario/${producto.id}`);
      setAviso(
        respuesta.borrado
          ? `«${producto.name}» se borró.`
          : `«${producto.name}» se archivó. Su historial sigue disponible.`,
      );
      void cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos borrar el producto');
    }
  }

  /**
   * Abre el producto para ponerle el precio que le falta.
   *
   * El aviso trae solo nombre e id —viene sin filtrar, del catálogo entero—
   * así que el producto completo se busca en la lista que está en pantalla. Si
   * no está ahí es porque algún filtro lo dejó fuera: entonces se busca por
   * nombre y aparece, en vez de que el botón no haga nada.
   */
  function ponerPrecio(aviso: SinPrecio) {
    const producto = items.find((p) => p.id === aviso.id);
    if (producto) {
      setEditando(producto);
      return;
    }
    setFiltroTipo('');
    setSoloBajos(false);
    setSoloPorVencer(false);
    setBusqueda(aviso.name);
    setVista('existencias');
  }

  async function reactivar(producto: Producto) {
    try {
      await api.put(`/api/inventario/${producto.id}`, {
        name: producto.name,
        kind: producto.kind,
        sku: producto.sku,
        unit: producto.unit,
        presentation: producto.presentation,
        minStock: producto.minStock,
        notes: producto.notes,
        active: true,
      });
      setAviso(`«${producto.name}» volvió al inventario.`);
      void cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos reactivar el producto');
    }
  }

  /**
   * Corrige un movimiento mal anotado. NO lo borra.
   *
   * Aquí había un botón de basura que borraba la fila. El historial del
   * inventario no se borra: si algo se anotó mal, se registra la corrección y
   * las dos cosas se quedan. Es lo único que permite responder después «¿por
   * qué el conteo no cuadra?» en vez de mirar un hueco.
   */
  async function corregirMovimiento(mov: Movimiento) {
    const signo = mov.type === 'SALIDA' ? '+' : '−';
    if (
      !window.confirm(
        `¿Corregir este movimiento de ${mov.quantity} ${mov.product.unit} de «${mov.product.name}»?\n\n` +
          `No se borra: se registra un movimiento de ${signo}${mov.quantity} que lo deshace, y los dos ` +
          'quedan en el historial. La existencia vuelve a su valor anterior.',
      )
    ) {
      return;
    }

    const motivo = window.prompt('¿Por qué se corrige? (opcional)') ?? undefined;

    try {
      await api.patch('/api/inventario/movimientos', { id: mov.id, motivo });
      setAviso('Se registró la corrección. El movimiento original sigue en el historial.');
      void cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos corregir el movimiento');
    }
  }

  /**
   * Quién puede tocar el catálogo.
   *
   * Recepción registra entradas y salidas —es el trabajo del día— pero no da
   * de alta productos, no les cambia el precio ni el mínimo, y no archiva
   * nada. Eso son decisiones del centro, no del mostrador.
   *
   * El servidor es quien manda: estas dos líneas solo evitan enseñar botones
   * que van a devolver un error. Esconder algo en el navegador nunca es la
   * seguridad, es la cortesía.
   */
  const puedeEditarCatalogo = usuario?.role === 'ADMIN' || usuario?.role === 'PROFESIONAL';
  const puedeArchivar = usuario?.role === 'ADMIN';

  const bajos = items.filter((p) => p.bajo).length;
  /**
   * Los que quedaron por debajo de cero.
   *
   * Se cuentan aparte de los «bajos» porque son otro problema: no es que se
   * esté acabando, es que la cuenta no cuadra y hay entradas sin registrar.
   */
  const enNegativo = items.filter((p) => p.stock < 0);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Inventario</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Medicamentos e insumos, con sus entradas, salidas y lo que se le aplicó a cada paciente.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void descargar()}
            disabled={descargando}
            className="btn-outline text-sm"
          >
            {descargando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            )}
            Descargar Excel
          </button>
          {puedeEditarCatalogo && (
            <button type="button" onClick={() => setNuevoProducto(true)} className="btn-primary">
              <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
              Nuevo producto
            </button>
          )}
        </div>
      </div>

      {/* ---- Avisos ------------------------------------------------- */}
      {enNegativo.length > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-bad/40 bg-bad-bg p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad" strokeWidth={1.8} aria-hidden />
          <div className="min-w-0 text-sm text-bad">
            <strong>
              {enNegativo.length === 1
                ? 'Un producto quedó en negativo.'
                : `${enNegativo.length} productos quedaron en negativo.`}
            </strong>
            <span className="mt-0.5 block text-bad/80">
              Se vendió o se usó más de lo que había registrado, casi siempre porque falta anotar
              una compra. Registra la entrada que falte y el número se acomoda solo:{' '}
              {enNegativo.map((p) => `${p.name} (${p.stock})`).join(' · ')}.
            </span>
          </div>
        </div>
      )}

      {/*
        Sin precio, lo vendido no deja registrado cuánto valía. El aviso va
        arriba y con los nombres a la mano porque lo que hace falta es
        ponérselo, no enterarse: si hay que ir a buscar cuál era, se deja para
        después.
      */}
      {sinPrecio.length > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn-bg p-4">
          <CircleDollarSign
            className="mt-0.5 h-4 w-4 shrink-0 text-warn"
            strokeWidth={1.8}
            aria-hidden
          />
          <div className="min-w-0 text-sm text-warn">
            <strong>
              {sinPrecio.length === 1
                ? 'Un producto no tiene precio de venta.'
                : `${sinPrecio.length} productos no tienen precio de venta.`}
            </strong>
            <span className="mt-0.5 block text-warn">
              Sin precio no queda registrado cuánto vale lo que sale.{' '}
              {puedeEditarCatalogo
                ? 'Toca el nombre para ponérselo:'
                : 'Pídele a alguien del centro que se lo ponga:'}
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sinPrecio.map((p) =>
                puedeEditarCatalogo ? (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => ponerPrecio(p)}
                    className="rounded-lg border border-warn/30 bg-white/70 px-2.5 py-1 text-xs font-medium text-warn transition-colors hover:bg-white"
                  >
                    {p.name}
                  </button>
                ) : (
                  <span
                    key={p.id}
                    className="rounded-lg border border-warn/30 px-2.5 py-1 text-xs text-warn"
                  >
                    {p.name}
                  </span>
                ),
              )}
            </div>
          </div>
        </div>
      )}

      {(bajos > 0 || porVencer.length > 0) && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {bajos > 0 && (
            <button
              type="button"
              onClick={() => {
                setSoloBajos(true);
                setVista('existencias');
              }}
              className="flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn-bg p-4 text-left"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" strokeWidth={1.8} aria-hidden />
              <span className="text-sm text-warn">
                <strong>
                  {bajos} {bajos === 1 ? 'producto está' : 'productos están'} en mínimo o por debajo.
                </strong>
                <span className="mt-0.5 block text-warn">Toca para verlos.</span>
              </span>
            </button>
          )}

          {porVencer.length > 0 && (
            <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={1.8} aria-hidden />
              <div className="min-w-0 text-sm">
                <strong className="block">
                  {porVencer.length} {porVencer.length === 1 ? 'lote vence' : 'lotes vencen'} en los
                  próximos dos meses
                </strong>
                <ul className="mt-1 space-y-0.5 text-muted">
                  {porVencer.slice(0, 3).map((lote) => (
                    <li key={lote.id} className="truncate">
                      {lote.product.name}
                      {lote.lotNumber && ` · lote ${lote.lotNumber}`} ·{' '}
                      {formatDateShort(lote.expiresAt)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- Vista y filtros ---------------------------------------- */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {(['existencias', 'movimientos'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              aria-pressed={vista === v}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                vista === v ? 'bg-brand-700 text-white' : 'text-ink/70 hover:bg-brand-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {vista === 'existencias' && (
          <>
            <div className="relative min-w-[14rem] flex-1">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                strokeWidth={1.8}
                aria-hidden
              />
              <input
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar por nombre o código"
                aria-label="Buscar productos"
                className="field pl-11"
              />
            </div>
            <select
              value={filtroTipo}
              onChange={(evento) => setFiltroTipo(evento.target.value as Tipo | '')}
              aria-label="Filtrar por tipo"
              className="field w-auto"
            >
              <option value="">Todo</option>
              <option value="MEDICAMENTO">Medicamentos</option>
              <option value="INSUMO">Insumos</option>
            </select>
            {/*
              El orden importa tanto como el filtro. Alfabético sirve para
              buscar un producto concreto; por vencimiento sirve para lo
              contrario, que es ver qué hay que usar o sacar del estante antes
              de que se pierda. Sin este selector, para saber qué vence primero
              había que abrir producto por producto.
            */}
            <select
              value={orden}
              onChange={(evento) => setOrden(evento.target.value as 'nombre' | 'vencimiento')}
              aria-label="Ordenar la lista"
              className="field w-auto"
            >
              <option value="nombre">Por nombre</option>
              <option value="vencimiento">Lo que vence primero</option>
            </select>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={soloPorVencer}
                onChange={(evento) => setSoloPorVencer(evento.target.checked)}
                className="h-4 w-4 rounded border-brand-300 text-brand-700 focus:ring-brand-500"
              />
              Solo por vencer
            </label>

            {soloBajos && (
              <button
                type="button"
                onClick={() => setSoloBajos(false)}
                className="btn-outline px-4 py-2 text-sm"
              >
                Quitar filtro de mínimos
              </button>
            )}
            {/*
              La casilla enseña LOS archivados, nada más.

              Antes los AÑADÍA al catálogo entero, y al marcarla salían los
              ochenta de siempre: parecía que hubiera un montón de productos
              muertos estorbando cuando en realidad había uno. Para revisar qué
              se archivó hace falta esa lista sola, que es lo que la casilla
              dice que hace.
            */}
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={verArchivados}
                onChange={(evento) => setVerArchivados(evento.target.checked)}
                className="h-4 w-4 rounded border-brand-300 text-brand-700 focus:ring-brand-500"
              />
              Ver archivados
            </label>
          </>
        )}
      </div>

      {error && (
        <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
      )}

      {aviso && (
        <p className="mt-6 rounded-2xl bg-brand-50 px-5 py-4 text-sm text-brand-800">{aviso}</p>
      )}

      {cargando ? (
        <div className="flex items-center gap-3 py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : vista === 'existencias' ? (
        items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <Package className="mx-auto h-7 w-7 text-brand-300" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 text-sm text-muted">
              {verArchivados && !busqueda && !filtroTipo && !soloBajos
                ? 'No hay ningún producto archivado.'
                : busqueda || filtroTipo || soloBajos || verArchivados
                  ? 'Ningún producto coincide.'
                  : 'Todavía no hay productos registrados.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="border-b border-line bg-cream/60 text-left text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-5 py-4 font-medium">Producto</th>
                  <th scope="col" className="px-5 py-4 font-medium">Tipo</th>
                  <th scope="col" className="px-5 py-4 text-right font-medium">Existencia</th>
                  <th scope="col" className="px-5 py-4 text-right font-medium">Mínimo</th>
                  <th scope="col" className="px-5 py-4 font-medium">Vence</th>
                  <th scope="col" className="px-5 py-4 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((producto) => (
                  <tr key={producto.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-4">
                      <span className={`font-medium ${producto.active ? '' : 'text-muted'}`}>
                        {producto.name}
                      </span>
                      {!producto.active && (
                        <span className="ml-2 rounded-full bg-line/60 px-2 py-0.5 text-[0.65rem] text-ink/60">
                          Archivado
                        </span>
                      )}
                      {producto.presentation && (
                        <span className="block text-xs text-muted">{producto.presentation}</span>
                      )}
                      {producto.sku && (
                        <span className="block text-xs text-muted">Código {producto.sku}</span>
                      )}
                      {producto.supplier && (
                        <span className="block text-xs text-muted">{producto.supplier}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
                        {producto.category ?? TIPOS[producto.kind]}
                      </span>
                      {producto.salePrice !== null && (
                        <span className="mt-1 block text-xs tabular-nums text-muted">
                          {formatCop(producto.salePrice)}
                        </span>
                      )}
                    </td>
                    {/*
                      Una existencia NEGATIVA no es lo mismo que una baja, y
                      antes se veían igual. Significa que se vendió o se usó más
                      de lo que la base creía que había: casi siempre una entrada
                      que nadie registró. No es un error del sistema, es un
                      conteo por cuadrar, y hasta que alguien lo mire el número
                      de al lado tampoco es de fiar. Por eso va en rojo y con su
                      motivo, no en el ámbar de «se está acabando».
                    */}
                    <td className="px-5 py-4 text-right">
                      <span
                        className={`font-medium tabular-nums ${
                          producto.stock < 0
                            ? 'text-bad'
                            : producto.bajo
                              ? 'text-warn'
                              : ''
                        }`}
                      >
                        {producto.stock}
                      </span>
                      <span className="ml-1 text-xs text-muted">{producto.unit}</span>
                      {producto.stock < 0 ? (
                        <span className="mt-0.5 block text-xs text-bad">
                          Falta registrar entradas
                        </span>
                      ) : (
                        producto.bajo && (
                          <span className="mt-0.5 block text-xs text-warn">En mínimo</span>
                        )
                      )}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-muted">
                      {producto.minStock > 0 ? producto.minStock : '—'}
                    </td>
                    {/*
                      La fecha del lote más viejo que se recibió, no de «lo que
                      queda»: el sistema no sigue el rastro de qué lote salió.
                      Sirve para ir a mirar el estante, que es lo que se hace de
                      verdad.
                    */}
                    <td className="px-5 py-4 text-sm">
                      {producto.venceEl ? (
                        <span
                          className={
                            producto.vencido
                              ? 'font-medium text-bad'
                              : producto.porVencer
                                ? 'font-medium text-warn'
                                : 'text-muted'
                          }
                        >
                          {formatDateShort(producto.venceEl)}
                          {producto.vencido && <span className="block text-xs">Vencido</span>}
                          {producto.porVencer && <span className="block text-xs">Vence pronto</span>}
                        </span>
                      ) : (
                        <span className="text-muted/60" title="Nadie anotó la fecha al registrar la entrada">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-1">
                        {producto.active ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setMovimientoDe(producto)}
                              className="btn-outline px-3 py-1.5 text-xs"
                            >
                              <SlidersHorizontal
                                className="h-3.5 w-3.5"
                                strokeWidth={1.8}
                                aria-hidden
                              />
                              Registrar
                            </button>
                            {puedeEditarCatalogo && (
                              <button
                                type="button"
                                onClick={() => setEditando(producto)}
                                aria-label={`Editar ${producto.name}`}
                                className="btn-outline px-2.5 py-1.5"
                              >
                                <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                              </button>
                            )}
                            {/* Borrar y archivar es cosa del administrador: se
                                lleva por delante un producto del catálogo. */}
                            {puedeArchivar && (
                              <button
                                type="button"
                                onClick={() => void borrarProducto(producto)}
                                aria-label={`Borrar ${producto.name}`}
                                className="btn-outline px-2.5 py-1.5 text-bad hover:border-bad/40 hover:bg-bad-bg"
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                              </button>
                            )}
                          </>
                        ) : (
                          puedeEditarCatalogo && (
                          <button
                            type="button"
                            onClick={() => void reactivar(producto)}
                            className="btn-outline px-3 py-1.5 text-xs"
                          >
                            <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                            Reactivar
                          </button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : movimientos.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          Todavía no hay movimientos registrados.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="border-b border-line bg-cream/60 text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-5 py-4 font-medium">Fecha</th>
                <th scope="col" className="px-5 py-4 font-medium">Producto</th>
                <th scope="col" className="px-5 py-4 font-medium">Motivo</th>
                <th scope="col" className="px-5 py-4 font-medium">Paciente</th>
                <th scope="col" className="px-5 py-4 text-right font-medium">Cantidad</th>
                {puedeArchivar && <th scope="col" className="px-5 py-4" />}
              </tr>
            </thead>
            <tbody>
              {movimientos.map((mov) => (
                <tr key={mov.id} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-4 text-muted">{formatDateShort(mov.occurredAt)}</td>
                  <td className="px-5 py-4">
                    <span className="font-medium">{mov.product.name}</span>
                    {mov.lotNumber && (
                      <span className="block text-xs text-muted">Lote {mov.lotNumber}</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {MOTIVOS[mov.reason]}
                    {mov.unitCost ? (
                      <span className="block text-xs text-muted">
                        {formatCop(mov.unitCost)} c/u
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-4 text-muted">{mov.patient?.fullName ?? '—'}</td>
                  <td className="px-5 py-4 text-right">
                    <span
                      className={`inline-flex items-center gap-1 font-medium tabular-nums ${
                        mov.type === 'SALIDA' ? 'text-bad' : 'text-brand-700'
                      }`}
                    >
                      {mov.type === 'SALIDA' ? (
                        <ArrowDownCircle className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                      ) : (
                        <ArrowUpCircle className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                      )}
                      {mov.type === 'SALIDA' ? '−' : '+'}
                      {mov.quantity}
                    </span>
                    <span className="ml-1 text-xs text-muted">{mov.product.unit}</span>
                  </td>
                  {puedeArchivar && (
                    <td className="px-5 py-4 text-right">
                      {mov.corregido ? (
                        <span className="text-xs text-muted">Corregido</span>
                      ) : mov.reason === 'CORRECCION' ? (
                        <span className="text-xs text-muted" title="Ya es una corrección">
                          —
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void corregirMovimiento(mov)}
                          aria-label={`Corregir el movimiento de ${mov.product.name}`}
                          title="Registra un movimiento que lo deshace. No se borra nada."
                          className="btn-outline px-2.5 py-1.5 text-sm"
                        >
                          <Undo2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                          Corregir
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(nuevoProducto || editando) && (
        <ProductoDialog
          producto={editando}
          onCerrar={() => {
            setNuevoProducto(false);
            setEditando(null);
          }}
          onGuardado={() => {
            setNuevoProducto(false);
            setEditando(null);
            void cargar();
          }}
        />
      )}

      {movimientoDe && (
        <MovimientoDialog
          producto={movimientoDe}
          onCerrar={() => setMovimientoDe(null)}
          onGuardado={() => {
            setMovimientoDe(null);
            void cargar();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Alta de producto
 * ------------------------------------------------------------------ */

function ProductoDialog({
  producto,
  onCerrar,
  onGuardado,
}: {
  /** Presente al editar; ausente al crear. */
  producto: Producto | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  /**
   * Lo que ya se usa en el inventario, para sugerirlo.
   *
   * Se saca de los productos que ya están en vez de una lista fija: así la
   * categoría que inventen mañana aparece sola en las sugerencias del día
   * siguiente, sin tocar el código.
   */
  const [categoriasConocidas, setCategoriasConocidas] = useState<string[]>([]);
  const [proveedoresConocidos, setProveedoresConocidos] = useState<string[]>([]);

  useEffect(() => {
    api
      .get<{ items: Producto[] }>('/api/inventario?incluirArchivados=true')
      .then((datos) => {
        const unicos = (valores: Array<string | null>) =>
          [...new Set(valores.filter((v): v is string => Boolean(v)))].sort();
        setCategoriasConocidas(unicos(datos.items.map((p) => p.category)));
        setProveedoresConocidos(unicos(datos.items.map((p) => p.supplier)));
      })
      .catch(() => {
        // Sin sugerencias se escribe a mano; no vale la pena molestar con un error.
      });
  }, []);

  const [form, setForm] = useState({
    name: producto?.name ?? '',
    kind: (producto?.kind ?? 'INSUMO') as Tipo,
    sku: producto?.sku ?? '',
    unit: producto?.unit ?? 'unidad',
    presentation: producto?.presentation ?? '',
    category: producto?.category ?? '',
    salePrice: producto?.salePrice ? String(producto.salePrice) : '',
    supplier: producto?.supplier ?? '',
    minStock: producto?.minStock ? String(producto.minStock) : '',
    cantidadInicial: '',
    notes: producto?.notes ?? '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    if (form.name.trim().length < 2) {
      setError('Escribe el nombre del producto.');
      return;
    }

    setGuardando(true);
    setError(null);

    const cuerpo = {
      name: form.name,
      kind: form.kind,
      sku: form.sku || null,
      unit: form.unit || 'unidad',
      presentation: form.presentation || null,
      category: form.category || null,
      salePrice: form.salePrice ? Number(form.salePrice.replace(/\D/g, '')) : null,
      supplier: form.supplier || null,
      minStock: form.minStock ? Number(form.minStock) : 0,
      notes: form.notes || null,
    };

    try {
      if (producto) {
        await api.put(`/api/inventario/${producto.id}`, cuerpo);
      } else {
        // La cantidad inicial solo existe al crear: en un producto que ya vive,
        // la existencia se cambia registrando un movimiento, nunca editando.
        await api.post('/api/inventario', {
          ...cuerpo,
          cantidadInicial: form.cantidadInicial ? Number(form.cantidadInicial) : 0,
        });
      }
      onGuardado();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : `No pudimos ${producto ? 'guardar' : 'crear'} el producto`,
      );
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-5 backdrop-blur-sm">
      <form
        onSubmit={enviar}
        noValidate
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-8"
      >
        <h2 className="font-display text-2xl">
          {producto ? 'Editar producto' : 'Nuevo producto'}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {producto
            ? 'Cambia la ficha del producto. Los movimientos ya registrados no se tocan.'
            : 'El producto y, si quieres, lo que ya tienes de él.'}
        </p>

        <div className="mt-7 space-y-5">
          <div>
            <label htmlFor="prod-name" className="field-label">Nombre *</label>
            <input
              id="prod-name"
              value={form.name}
              onChange={(evento) => setForm({ ...form, name: evento.target.value })}
              className="field"
              placeholder="Minoxidil 5%"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="prod-kind" className="field-label">Tipo *</label>
              <select
                id="prod-kind"
                value={form.kind}
                onChange={(evento) => setForm({ ...form, kind: evento.target.value as Tipo })}
                className="field"
              >
                <option value="INSUMO">Insumo</option>
                <option value="MEDICAMENTO">Medicamento</option>
              </select>
            </div>
            <div>
              <label htmlFor="prod-unit" className="field-label">Se cuenta en *</label>
              <input
                id="prod-unit"
                value={form.unit}
                onChange={(evento) => setForm({ ...form, unit: evento.target.value })}
                list="unidades"
                className="field"
              />
              <datalist id="unidades">
                {['unidad', 'ampolla', 'vial', 'caja', 'ml', 'gramo', 'par'].map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label htmlFor="prod-present" className="field-label">
              Presentación <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id="prod-present"
              value={form.presentation}
              onChange={(evento) => setForm({ ...form, presentation: evento.target.value })}
              className="field"
              placeholder="Vial 5 ml"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="prod-category" className="field-label">
                Categoría <span className="font-normal text-muted">(opcional)</span>
              </label>
              {/*
                Lista abierta, no desplegable: las categorías las decide el
                centro y aparecen nuevas. `datalist` sugiere las que ya se usan
                sin impedir escribir una que no está.
              */}
              <input
                id="prod-category"
                value={form.category}
                onChange={(evento) => setForm({ ...form, category: evento.target.value })}
                list="categorias-producto"
                className="field"
                placeholder="MEDICAMENTO"
              />
              <datalist id="categorias-producto">
                {categoriasConocidas.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="prod-supplier" className="field-label">
                Proveedor <span className="font-normal text-muted">(opcional)</span>
              </label>
              <input
                id="prod-supplier"
                value={form.supplier}
                onChange={(evento) => setForm({ ...form, supplier: evento.target.value })}
                list="proveedores-producto"
                className="field"
                placeholder="DISTRIMAYOR"
              />
              <datalist id="proveedores-producto">
                {proveedoresConocidos.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label htmlFor="prod-venta" className="field-label">
              Precio de venta <span className="font-normal text-muted">(opcional)</span>
            </label>
            {/*
              Solo el de VENTA. El de compra no se pone acá: cambia con cada
              pedido y va en la entrada de stock, que es donde queda el
              historial de cuánto costó cada vez.
            */}
            <input
              id="prod-venta"
              inputMode="numeric"
              value={form.salePrice}
              onChange={(evento) =>
                setForm({ ...form, salePrice: evento.target.value.replace(/[^\d]/g, '') })
              }
              className="field tabular-nums sm:max-w-[14rem]"
              placeholder="91000"
            />
          </div>

          {/* Las dos cantidades juntas: una dice cuánto hay, la otra cuándo avisar. */}
          <div className="grid gap-5 sm:grid-cols-2">
            {!producto && (
              <div>
                <label htmlFor="prod-inicial" className="field-label">
                  ¿Cuántos hay ahora? <span className="font-normal text-muted">(opcional)</span>
                </label>
                <input
                  id="prod-inicial"
                  inputMode="numeric"
                  value={form.cantidadInicial}
                  onChange={(evento) =>
                    setForm({ ...form, cantidadInicial: evento.target.value.replace(/[^\d]/g, '') })
                  }
                  className="field tabular-nums"
                  placeholder="0"
                />
                <p className="mt-1.5 text-xs text-muted">
                  Lo que tengas en el estante hoy. Queda anotado como una entrada por conteo, así
                  que el historial arranca contando la verdad. Después cambia solo con movimientos.
                </p>
              </div>
            )}

            <div>
              <label htmlFor="prod-min" className="field-label">
                Aviso cuando queden <span className="font-normal text-muted">(opcional)</span>
              </label>
              <input
                id="prod-min"
                inputMode="numeric"
                value={form.minStock}
                onChange={(evento) =>
                  setForm({ ...form, minStock: evento.target.value.replace(/[^\d]/g, '') })
                }
                className="field tabular-nums"
                placeholder="Sin aviso"
              />
              <p className="mt-1.5 text-xs text-muted">
                Si pones 5, el inventario te avisa cuando queden 5 o menos, para que alcances a
                reponer. Déjalo vacío si no quieres avisos de este producto.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="prod-sku" className="field-label">
              Código <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id="prod-sku"
              value={form.sku}
              onChange={(evento) => setForm({ ...form, sku: evento.target.value })}
              className="field"
              placeholder="Interno o de barras"
            />
          </div>

          <div>
            <label htmlFor="prod-notes" className="field-label">
              Notas <span className="font-normal text-muted">(opcional)</span>
            </label>
            <textarea
              id="prod-notes"
              rows={2}
              value={form.notes}
              onChange={(evento) => setForm({ ...form, notes: evento.target.value })}
              className="field resize-none"
              placeholder="Proveedor habitual, condiciones de conservación…"
            />
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="submit" disabled={guardando} className="btn-primary flex-1">
            {guardando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : producto ? (
              'Guardar cambios'
            ) : (
              'Crear producto'
            )}
          </button>
          <button type="button" onClick={onCerrar} className="btn-outline px-6">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Movimiento
 * ------------------------------------------------------------------ */

function MovimientoDialog({
  producto,
  onCerrar,
  onGuardado,
}: {
  producto: Producto;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  /** El paciente entero, para que el buscador muestre a quién se eligió. */
  const [paciente, setPaciente] = useState<{
    id: string;
    fullName: string;
    documentId?: string | null;
  } | null>(null);
  const [form, setForm] = useState({
    type: 'ENTRADA' as TipoMov,
    reason: 'COMPRA' as Motivo,
    quantity: '',
    fecha: hoyEnClinica(),
    patientId: '',
    lotNumber: '',
    expiresAt: '',
    unitCost: '',
    notes: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Al cambiar el tipo, el motivo salta al primero que tenga sentido. */
  function cambiarTipo(type: TipoMov) {
    setForm((actual) => ({ ...actual, type, reason: MOTIVOS_POR_TIPO[type][0] }));
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    if (!form.quantity || Number(form.quantity) <= 0) {
      setError('Escribe la cantidad.');
      return;
    }
    if (form.reason === 'USO_EN_PACIENTE' && !form.patientId) {
      setError('Elige a qué paciente se le aplicó.');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      await api.post('/api/inventario/movimientos', {
        productId: producto.id,
        type: form.type,
        reason: form.reason,
        quantity: Number(form.quantity),
        fecha: form.fecha,
        patientId: form.patientId || null,
        lotNumber: form.lotNumber || null,
        expiresAt: form.expiresAt || null,
        unitCost: form.unitCost ? Number(form.unitCost) : null,
        notes: form.notes || null,
      });
      onGuardado();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos registrar el movimiento');
      setGuardando(false);
    }
  }

  const esEntrada = form.type === 'ENTRADA';
  const esMedicamento = producto.kind === 'MEDICAMENTO';

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-5 backdrop-blur-sm">
      <form
        onSubmit={enviar}
        noValidate
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-8"
      >
        <h2 className="font-display text-2xl">{producto.name}</h2>
        <p className="mt-1 text-sm text-muted">
          Existencia actual: <strong className="text-ink">{producto.stock}</strong> {producto.unit}
        </p>

        <div className="mt-7 space-y-5">
          <div>
            <span className="field-label">Movimiento *</span>
            <div className="flex flex-wrap gap-2">
              {(['ENTRADA', 'SALIDA', 'AJUSTE'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => cambiarTipo(t)}
                  aria-pressed={form.type === t}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-medium capitalize transition-colors ${
                    form.type === t
                      ? 'border-brand-700 bg-brand-700 text-white'
                      : 'border-line hover:border-brand-400'
                  }`}
                >
                  {t.toLowerCase()}
                </button>
              ))}
            </div>
            {form.type === 'AJUSTE' && (
              <p className="mt-2 text-xs text-muted">
                El ajuste SUMA a la existencia. Para bajarla por un conteo, usa una salida.
              </p>
            )}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="mov-cantidad" className="field-label">
                Cantidad * <span className="font-normal text-muted">({producto.unit})</span>
              </label>
              <input
                id="mov-cantidad"
                inputMode="numeric"
                value={form.quantity}
                onChange={(evento) =>
                  setForm({ ...form, quantity: evento.target.value.replace(/[^\d]/g, '') })
                }
                className="field tabular-nums"
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="mov-fecha" className="field-label">Fecha *</label>
              <input
                id="mov-fecha"
                type="date"
                value={form.fecha}
                onChange={(evento) => setForm({ ...form, fecha: evento.target.value })}
                className="field"
              />
            </div>
          </div>

          <div>
            <label htmlFor="mov-motivo" className="field-label">Motivo *</label>
            <select
              id="mov-motivo"
              value={form.reason}
              onChange={(evento) => setForm({ ...form, reason: evento.target.value as Motivo })}
              className="field"
            >
              {MOTIVOS_POR_TIPO[form.type].map((m) => (
                <option key={m} value={m}>
                  {MOTIVOS[m]}
                </option>
              ))}
            </select>
          </div>

          {form.reason === 'USO_EN_PACIENTE' && (
            <div>
              <span className="field-label">Paciente *</span>
              <BuscadorPaciente
                seleccionado={paciente}
                onSeleccionar={(encontrado) => {
                  setPaciente({
                    id: encontrado.id,
                    fullName: encontrado.fullName,
                    documentId: encontrado.documentId,
                  });
                  setForm((actual) => ({ ...actual, patientId: encontrado.id }));
                }}
                onQuitar={() => {
                  setPaciente(null);
                  setForm((actual) => ({ ...actual, patientId: '' }));
                }}
              />
              <p className="mt-1.5 text-xs text-muted">
                Queda en su historial: es lo que responde qué se le aplicó y cuándo.
              </p>
            </div>
          )}

          {esEntrada && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="mov-lote" className="field-label">
                    Lote{' '}
                    <span className="font-normal text-muted">
                      {esMedicamento ? '(recomendado)' : '(opcional)'}
                    </span>
                  </label>
                  <input
                    id="mov-lote"
                    value={form.lotNumber}
                    onChange={(evento) => setForm({ ...form, lotNumber: evento.target.value })}
                    className="field"
                  />
                </div>
                <div>
                  <label htmlFor="mov-vence" className="field-label">
                    Vence{' '}
                    <span className="font-normal text-muted">
                      {esMedicamento ? '(recomendado)' : '(opcional)'}
                    </span>
                  </label>
                  <input
                    id="mov-vence"
                    type="date"
                    value={form.expiresAt}
                    onChange={(evento) => setForm({ ...form, expiresAt: evento.target.value })}
                    className="field"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="mov-costo" className="field-label">
                  Costo unitario <span className="font-normal text-muted">(opcional)</span>
                </label>
                <input
                  id="mov-costo"
                  inputMode="numeric"
                  value={form.unitCost}
                  onChange={(evento) =>
                    setForm({ ...form, unitCost: evento.target.value.replace(/[^\d]/g, '') })
                  }
                  className="field tabular-nums"
                  placeholder="0"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="mov-notas" className="field-label">
              Nota <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id="mov-notas"
              value={form.notes}
              onChange={(evento) => setForm({ ...form, notes: evento.target.value })}
              className="field"
              placeholder="Proveedor, factura de compra, quién lo recibió…"
            />
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="submit" disabled={guardando} className="btn-primary flex-1">
            {guardando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Registrando…
              </>
            ) : (
              'Registrar movimiento'
            )}
          </button>
          <button type="button" onClick={onCerrar} className="btn-outline px-6">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
