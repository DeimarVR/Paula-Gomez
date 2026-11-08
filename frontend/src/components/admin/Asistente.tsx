'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bot, Loader2, Send, Sparkles, X } from 'lucide-react';
import { api } from '@/lib/apiClient';

/**
 * El chat del panel.
 *
 * Muestra la conversación y ejecuta lo que el asistente devuelve. Las acciones
 * que solo miran —navegar, buscar, consultar— se hacen de una. Las que
 * escriben esperan a que la persona diga que sí, con el resumen delante.
 *
 * El servidor decide qué es cada cosa; aquí no se adivina. Si llega
 * `necesitaConfirmar`, se pregunta, y punto.
 */

interface Accion {
  type: string;
  [param: string]: unknown;
}

interface Turno {
  de: 'yo' | 'asistente';
  texto: string;
  /** Pendiente de confirmación, con lo que va a pasar escrito. */
  porConfirmar?: { accion: Accion; resumen: string };
  /** Ya se resolvió: se contesta sí o no y el bloque queda quieto. */
  resuelto?: 'si' | 'no';
}

interface Respuesta {
  reply: string;
  action?: Accion;
  necesitaConfirmar?: boolean;
  resumen?: string;
}

/** A dónde lleva cada pantalla. Misma lista que la del servidor. */
const PANTALLAS: Record<string, string> = {
  inicio: '/admin',
  citas: '/admin/citas',
  pacientes: '/admin/pacientes',
  'control-pacientes': '/admin/control-pacientes',
  inventario: '/admin/inventario',
  consentimientos: '/admin/consentimientos',
  fotos: '/admin/fotos',
  tratamientos: '/admin/tratamientos',
  mensajes: '/admin/mensajes',
  sitio: '/admin/sitio',
  horario: '/admin/horario',
};

/** Una dirección con sus parámetros, saltándose los que vienen vacíos. */
function conParametros(base: string, params: Record<string, unknown>): string {
  const busqueda = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === undefined || valor === null || valor === '') continue;
    if (clave === 'type' || clave === 'confirmada') continue;
    busqueda.set(clave, String(valor));
  }
  const cola = busqueda.toString();
  return cola ? `${base}?${cola}` : base;
}

const SALUDO =
  'Dime qué necesitas. Puedo llevarte a una pantalla, buscar un paciente, consultar la ' +
  'agenda o el inventario, o dejarte listo un formulario de cita o paciente.';

export function Asistente() {
  const router = useRouter();
  const pathname = usePathname();

  const [abierto, setAbierto] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([{ de: 'asistente', texto: SALUDO }]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const campoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (abierto) {
      finRef.current?.scrollIntoView({ behavior: 'smooth' });
      campoRef.current?.focus();
    }
  }, [turnos, abierto]);

  /** Cierra con Escape, como cualquier panel que se abre encima. */
  useEffect(() => {
    if (!abierto) return;
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setAbierto(false);
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [abierto]);

  const decir = useCallback((texto: string) => {
    setTurnos((previos) => [...previos, { de: 'asistente', texto }]);
  }, []);

  /**
   * Hace la acción.
   *
   * Las de mirar son una navegación con sus parámetros. Las de escribir pegan
   * contra la ruta de siempre, la misma que usa el formulario de la pantalla:
   * no hay un camino paralelo que se salte validaciones.
   */
  const ejecutar = useCallback(
    async (accion: Accion) => {
      const { type, ...params } = accion;

      switch (type) {
        case 'navegar':
          router.push(PANTALLAS[String(params.pantalla)] ?? '/admin');
          return;
        case 'buscar_paciente':
          router.push(conParametros('/admin/pacientes', { q: params.q }));
          return;
        case 'consultar_agenda':
          router.push(conParametros('/admin/citas', { fecha: params.fecha }));
          return;
        case 'consultar_inventario':
          router.push(conParametros('/admin/inventario', params));
          return;

        case 'nueva_cita':
          router.push(conParametros('/admin/citas', { ...params, nueva: '1' }));
          return;
        case 'nuevo_paciente':
          router.push(conParametros('/admin/pacientes', { ...params, nuevo: '1' }));
          return;

        case 'movimiento_inventario': {
          /*
           * Esta sí escribe, y ya viene confirmada: el servidor no deja llegar
           * aquí nada que la persona no haya aceptado.
           */
          const productos = await api.get<{ items: Array<{ id: string; name: string }> }>(
            conParametros('/api/inventario', { q: params.producto }),
          );
          const producto = productos.items[0];
          if (!producto) {
            decir(`No encontré ningún producto que se llame «${params.producto}».`);
            return;
          }
          if (productos.items.length > 1) {
            decir(
              `Hay ${productos.items.length} productos que coinciden con «${params.producto}». ` +
                'Mejor regístralo desde inventario para no equivocar el producto.',
            );
            router.push(conParametros('/admin/inventario', { q: params.producto }));
            return;
          }

          await api.post('/api/inventario/movimientos', {
            productId: producto.id,
            type: params.tipo,
            reason: params.motivo ?? (params.tipo === 'ENTRADA' ? 'COMPRA' : 'OTRO'),
            quantity: params.cantidad,
            occurredAt: new Date().toISOString().slice(0, 10),
          });
          decir(`Registrado: ${params.tipo === 'SALIDA' ? 'salida' : 'entrada'} de ${params.cantidad} de «${producto.name}».`);
          router.push(conParametros('/admin/inventario', { q: producto.name }));
          return;
        }

        default:
          decir('Esa acción todavía no la sé hacer.');
      }
    },
    [router, decir],
  );

  async function enviar(mensaje: string, confirmar?: { type: string; params: Accion }) {
    const limpio = mensaje.trim();
    if (!limpio && !confirmar) return;

    if (limpio) setTurnos((previos) => [...previos, { de: 'yo', texto: limpio }]);
    setTexto('');
    setPensando(true);

    try {
      /*
       * Solo los últimos turnos. Mandar la conversación entera no mejora la
       * respuesta y sí hace cada mensaje más caro.
       */
      const history = turnos
        .filter((t) => !t.porConfirmar)
        .slice(-8)
        .map((t) => ({ role: t.de === 'yo' ? ('user' as const) : ('assistant' as const), content: t.texto }));

      const salida = await api.post<Respuesta>(
        '/api/asistente',
        {
          message: limpio || 'sí',
          history,
          pantalla: pathname,
          ...(confirmar ? { confirmar: { type: confirmar.type, params: confirmar.params } } : {}),
        },
        /*
         * El navegador espera MÁS que el servidor a propósito. El servidor
         * corta la llamada al modelo a los 20 segundos y contesta con una
         * frase escrita; si el navegador cortara antes, esa frase no llegaría
         * y la persona vería un error de red pelado.
         */
        { signal: AbortSignal.timeout(45_000) },
      );

      if (salida.necesitaConfirmar && salida.action) {
        setTurnos((previos) => [
          ...previos,
          {
            de: 'asistente',
            texto: salida.reply,
            porConfirmar: { accion: salida.action!, resumen: salida.resumen ?? '' },
          },
        ]);
        return;
      }

      decir(salida.reply);
      if (salida.action) await ejecutar(salida.action);
    } catch (fallo) {
      /* El detalle técnico se queda en la consola; aquí va una frase. */
      console.error('[asistente]', fallo);
      decir(
        fallo instanceof Error && fallo.message
          ? fallo.message
          : 'No pude responder ahora mismo. Inténtalo otra vez.',
      );
    } finally {
      setPensando(false);
    }
  }

  function responderConfirmacion(indice: number, acepta: boolean) {
    const turno = turnos[indice];
    if (!turno?.porConfirmar) return;

    setTurnos((previos) =>
      previos.map((t, i) => (i === indice ? { ...t, resuelto: acepta ? 'si' : 'no' } : t)),
    );

    if (!acepta) {
      decir('Listo, no hago nada.');
      return;
    }

    const { type, ...params } = turno.porConfirmar.accion;
    void enviar('', { type, params: { type, ...params } });
  }

  return (
    <>
      {!abierto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir el asistente"
          className="no-imprimir fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-white shadow-lift transition-transform hover:scale-105"
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.8} aria-hidden />
        </button>
      )}

      {abierto && (
        <div
          role="dialog"
          aria-label="Asistente"
          className="fixed inset-x-3 bottom-3 z-40 flex max-h-[min(34rem,80vh)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-lift sm:inset-x-auto sm:right-6 sm:w-[24rem]"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-cream px-4 py-3">
            <span className="flex items-center gap-2 font-display text-lg">
              <Bot className="h-4 w-4 text-brand-700" strokeWidth={1.8} aria-hidden />
              Asistente
            </span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-muted transition-colors hover:bg-brand-50"
            >
              <X className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {turnos.map((turno, indice) => (
              <div
                key={`${indice}-${turno.texto.slice(0, 12)}`}
                className={turno.de === 'yo' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    turno.de === 'yo'
                      ? 'bg-brand-700 text-white'
                      : 'bg-cream text-ink'
                  }`}
                >
                  {turno.texto}

                  {turno.porConfirmar && !turno.resuelto && (
                    <div className="mt-3 border-t border-line pt-3">
                      <p className="text-xs text-muted">{turno.porConfirmar.resumen}</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => responderConfirmacion(indice, true)}
                          className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          Sí, hazlo
                        </button>
                        <button
                          type="button"
                          onClick={() => responderConfirmacion(indice, false)}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}

                  {turno.resuelto && (
                    <p className="mt-2 text-xs text-muted">
                      {turno.resuelto === 'si' ? 'Confirmado.' : 'Cancelado.'}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {pensando && (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Pensando…
              </div>
            )}
            <div ref={finRef} />
          </div>

          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              void enviar(texto);
            }}
            className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-3"
          >
            <label htmlFor="asistente-mensaje" className="sr-only">
              Escríbele al asistente
            </label>
            <input
              id="asistente-mensaje"
              ref={campoRef}
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder="Llévame a las citas…"
              disabled={pensando}
              className="field flex-1 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={pensando || !texto.trim()}
              aria-label="Enviar"
              className="btn-primary shrink-0 px-3 py-2"
            >
              <Send className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
