'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react';
import { api } from '@/lib/apiClient';

/**
 * La campana de avisos del panel.
 *
 * Los avisos del inventario ya existían, pero solo se veían entrando a
 * Inventario — y a Inventario se entra cuando ya se necesita algo, que es
 * tarde. Un producto agotado no avisaba: se descubría con el paciente en la
 * silla. Aquí están en todas las pantallas, sin tener que ir a buscarlos.
 *
 * La campana NO interrumpe. No hay ventanas emergentes ni sonidos: es un número
 * en un icono, y quien está atendiendo lo mira cuando puede. Un aviso que
 * interrumpe una consulta se aprende a cerrar sin leer, y a partir de ahí deja
 * de servir para siempre.
 *
 * Y el número cuenta solo lo que NO se ha visto. Estos avisos son estados, no
 * mensajes: «60 productos en el mínimo» es verdad todos los días hasta que
 * alguien compre, y un contador que nunca baja se vuelve parte del decorado.
 * Marcándolos como vistos la campana se calla, y vuelve a hablar sola el día
 * que caiga un producto más. Lo que sigue pendiente no desaparece: se queda en
 * la lista, sin número, para quien vaya a mirar.
 */

type Gravedad = 'alta' | 'media';

interface Aviso {
  id: string;
  gravedad: Gravedad;
  titulo: string;
  detalle: string;
  href: string;
  /** Una por cosa concreta. Es lo que se marca como visto. */
  claves: string[];
  /** Cuántas de esas no se habían visto. */
  nuevos: number;
}

/** Cada cuánto se vuelve a preguntar. Cinco minutos: esto cambia despacio. */
const CADA = 5 * 60 * 1000;

export function CampanaAvisos() {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [marcando, setMarcando] = useState(false);
  const [abierta, setAbierta] = useState(false);
  const [cargando, setCargando] = useState(true);
  /**
   * Dónde se dibuja el panel, en coordenadas de la pantalla.
   *
   * No cuelga del botón: se coloca contra la ventana. Colgando del botón hacía
   * falta adivinar hacia qué lado abrir, y en el celular no acertaba ninguno —
   * la campana está tan a la derecha que hacia la izquierda no cabía, y hacia
   * la derecha tampoco—. Midiendo se acaba la adivinanza: se calcula dónde
   * entra y se pone ahí, con un dedo de margen contra los bordes.
   */
  const [sitio, setSitio] = useState<{ left: number; top?: number; bottom?: number; width: number } | null>(null);

  const contenedor = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  const cargar = useCallback(async (signal?: AbortSignal) => {
    try {
      const datos = await api.get<{ items: Aviso[]; sinLeer: number }>('/api/avisos', { signal });
      setAvisos(datos?.items ?? []);
      setSinLeer(datos?.sinLeer ?? 0);
    } catch {
      // Sin avisos no se estorba: la campana se queda callada. Un error rojo
      // permanente en la esquina de todas las pantallas sería mucho peor que
      // no saber que un producto está en el mínimo.
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  }, []);

  useEffect(() => {
    const control = new AbortController();
    void cargar(control.signal);
    const reloj = setInterval(() => void cargar(), CADA);
    return () => {
      control.abort();
      clearInterval(reloj);
    };
  }, [cargar]);

  // Al navegar se cierra sola: si no, el panel se queda abierto sobre la
  // pantalla nueva tapando justo lo que se fue a ver.
  useEffect(() => setAbierta(false), [pathname]);

  useEffect(() => {
    if (!abierta || !contenedor.current) return;

    const caja = contenedor.current.getBoundingClientRect();
    const MARGEN = 8;
    const ALTO_MAXIMO = 420;

    const ancho = Math.min(352, window.innerWidth - MARGEN * 2);

    /**
     * Alineado a la derecha del botón, pero sin salirse de la pantalla por
     * ninguno de los dos lados. `clamp` a mano porque el orden importa: primero
     * se empuja para que no se salga por la derecha, después por la izquierda.
     */
    const left = Math.max(
      MARGEN,
      Math.min(caja.right - ancho, window.innerWidth - ancho - MARGEN),
    );

    // Hacia abajo si cabe; si no, hacia arriba, que es lo que pasa cuando la
    // campana está en el pie de una barra lateral o con el teclado abierto.
    const abajo = window.innerHeight - caja.bottom - MARGEN;
    if (abajo >= Math.min(ALTO_MAXIMO, caja.top)) {
      setSitio({ left, top: caja.bottom + MARGEN, width: ancho });
    } else {
      setSitio({ left, bottom: window.innerHeight - caja.top + MARGEN, width: ancho });
    }
  }, [abierta]);

  // Cerrar al tocar fuera y con Escape, como cualquier menú.
  useEffect(() => {
    if (!abierta) return undefined;

    const fuera = (evento: MouseEvent) => {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierta(false);
    };
    const escape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierta(false);
    };

    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierta]);

  /**
   * Marca como vistos. Sin claves, todo lo que hay.
   *
   * La respuesta trae la campana ya recalculada, así que no hace falta volver a
   * preguntar: el número baja en el mismo momento en que se toca.
   */
  const marcar = useCallback(async (claves?: string[]) => {
    setMarcando(true);
    try {
      const datos = await api.post<{ items: Aviso[]; sinLeer: number }>('/api/avisos', { claves });
      setAvisos(datos?.items ?? []);
      setSinLeer(datos?.sinLeer ?? 0);
    } catch {
      // Si falla, el número se queda como estaba. Peor sería bajarlo sin haber
      // guardado nada y que volviera solo al recargar.
    } finally {
      setMarcando(false);
    }
  }, []);

  const cuantos = avisos.length;
  /** Rojo solo si lo NUEVO es algo que frena una atención hoy. */
  const urgentes = avisos.filter((a) => a.gravedad === 'alta' && a.nuevos > 0).length;

  return (
    <div ref={contenedor} className="relative">
      <button
        type="button"
        onClick={() => setAbierta((estaba) => !estaba)}
        aria-expanded={abierta}
        aria-haspopup="dialog"
        aria-label={
          sinLeer > 0
            ? `Avisos: ${sinLeer} sin leer`
            : cuantos === 0
              ? 'Avisos: no hay nada pendiente'
              : 'Avisos: nada nuevo'
        }
        className="icon-btn"
      >
        <Bell className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        {sinLeer > 0 && (
          /*
            El número, no un punto: «3» dice si vale la pena abrirlo ahora o
            después. Rojo solo cuando lo nuevo frena una atención hoy —un
            producto agotado o vencido—; lo demás es ámbar, que se mira sin
            correr.

            Y cuenta lo SIN LEER, no el total. Con 73 productos entre agotados y
            en el mínimo, un «73» permanente no dice nada; un «1» el día que cae
            otro, sí.
          */
          <span
            className={`absolute -right-1 -top-1 grid min-w-[1.25rem] place-items-center rounded-full px-1 text-[0.65rem] font-semibold text-white ${
              urgentes > 0 ? 'bg-bad' : 'bg-warn'
            }`}
          >
            {sinLeer}
          </span>
        )}
      </button>

      {abierta && sitio && (
        <div
          role="dialog"
          aria-label="Avisos"
          style={{
            left: sitio.left,
            ...(sitio.top !== undefined ? { top: sitio.top } : { bottom: sitio.bottom }),
            width: sitio.width,
          }}
          className="fixed z-40 overflow-hidden rounded-2xl border border-line bg-surface shadow-lift"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Avisos</p>
            {/*
              El botón solo aparece si hay algo sin leer. Un «marcar como
              leídas» siempre visible, sin nada que marcar, es un botón que no
              hace nada.
            */}
            {sinLeer > 0 && (
              <button
                type="button"
                onClick={() => void marcar()}
                disabled={marcando}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-brand-800 transition-colors hover:bg-brand-50 disabled:opacity-50"
              >
                {marcando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                )}
                Marcar como leídas
              </button>
            )}
          </div>

          {cargando && cuantos === 0 ? (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Mirando…
            </p>
          ) : cuantos === 0 ? (
            <p className="flex items-start gap-2 px-4 py-6 text-sm text-muted">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2} aria-hidden />
              Nada pendiente. El inventario está al día.
            </p>
          ) : (
            <ul className="max-h-[min(24rem,60vh)] overflow-y-auto overscroll-contain">
              {avisos.map((aviso) => (
                <li key={aviso.id} className="border-b border-line/60 last:border-0">
                  {/*
                    Ir a arreglarlo cuenta como leerlo: se marca este aviso al
                    tocarlo. Los demás siguen sin leer, que es lo honesto — no
                    se han mirado.
                  */}
                  <Link
                    href={aviso.href}
                    onClick={() => {
                      if (aviso.nuevos > 0) void marcar(aviso.claves);
                    }}
                    className={`flex gap-3 px-4 py-3 transition-colors hover:bg-brand-50 ${
                      aviso.nuevos === 0 ? 'opacity-60' : ''
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        aviso.nuevos === 0
                          ? 'bg-line'
                          : aviso.gravedad === 'alta'
                            ? 'bg-bad'
                            : 'bg-warn'
                      }`}
                    />
                    <span className="min-w-0">
                      <span
                        className={`block text-sm leading-snug ${
                          aviso.nuevos === 0 ? 'font-normal' : 'font-medium'
                        }`}
                      >
                        {aviso.titulo}
                        {/* Lo nuevo dentro de un aviso que ya se había visto:
                            «60 en el mínimo» con 1 recién caído. */}
                        {aviso.nuevos > 0 && aviso.nuevos < aviso.claves.length && (
                          <span className="ml-1.5 rounded-full bg-warn-bg px-1.5 py-0.5 text-[0.65rem] font-medium text-warn">
                            {aviso.nuevos} nuevo{aviso.nuevos === 1 ? '' : 's'}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block break-words text-xs leading-relaxed text-muted">
                        {aviso.detalle}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
