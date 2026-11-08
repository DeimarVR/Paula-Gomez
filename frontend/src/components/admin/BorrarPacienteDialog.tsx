'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Archive, Loader2, Trash2, X } from 'lucide-react';
import { api } from '@/lib/apiClient';

/**
 * Confirmar el borrado de un paciente.
 *
 * Pregunta DESPUÉS de mirar, no antes. Un «¿seguro que quieres borrar?» a secas
 * no le dice a nadie si está a punto de quitar un duplicado vacío o la ficha de
 * una paciente con tres años de historia, que es exactamente lo que hay que
 * saber para responder. Así que el diálogo primero pide qué tiene el paciente y
 * sobre eso arma la pregunta.
 *
 * Cuando no se puede borrar no se enseña un botón apagado: se enseña la salida
 * que sí sirve —marcarlo inactivo—, que es lo que esa persona quería de verdad
 * (que deje de aparecer en la lista).
 */

interface LoQueTiene {
  citas: number;
  fichas: number;
  fichasFaciales: number;
  facturas: number;
  fotos: number;
  planes: number;
  consentimientos: number;
  movimientos: number;
}

interface Estado {
  id: string;
  nombre: string;
  activo: boolean;
  tiene: LoQueTiene;
  sePuedeBorrar: boolean;
  resumen: string[];
}

interface Props {
  pacienteId: string;
  /** Solo para poder titular el diálogo mientras carga lo demás. */
  nombre: string;
  onCerrar: () => void;
  /** Se borró o se archivó: quien abrió el diálogo decide qué hacer. */
  onListo: (que: 'borrado' | 'archivado') => void;
}

export function BorrarPacienteDialog({ pacienteId, nombre, onCerrar, onListo }: Props) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    api
      .get<Estado>(`/api/patients/${pacienteId}/eliminar`)
      .then((datos) => {
        if (vivo) setEstado(datos);
      })
      .catch((caught: unknown) => {
        if (vivo) {
          setError(caught instanceof Error ? caught.message : 'No pudimos revisar el paciente');
        }
      })
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [pacienteId]);

  /**
   * Escape cierra, salvo mientras se está borrando.
   *
   * Cerrar a mitad de la petición no la cancela: el paciente se borra igual y
   * la lista se queda mostrándolo como si nada hubiera pasado, hasta que
   * alguien recargue. Mejor no dejar cerrar esos dos segundos.
   */
  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      if (evento.key === 'Escape' && !trabajando) onCerrar();
    }
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar, trabajando]);

  async function borrar() {
    setTrabajando(true);
    setError(null);
    try {
      await api.delete(`/api/patients/${pacienteId}/eliminar`);
      onListo('borrado');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos borrar el paciente');
      setTrabajando(false);
    }
  }

  async function archivar() {
    setTrabajando(true);
    setError(null);
    try {
      await api.post(`/api/patients/${pacienteId}/eliminar`);
      onListo('archivado');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos marcarlo como inactivo');
      setTrabajando(false);
    }
  }

  const titulo = estado?.nombre ?? nombre;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="borrar-paciente-titulo"
    >
      <div className="max-h-[90vh] w-full min-w-0 max-w-md overflow-y-auto rounded-2xl bg-surface p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 id="borrar-paciente-titulo" className="font-display text-2xl leading-tight">
            Borrar a {titulo}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            disabled={trabajando}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-brand-50 disabled:opacity-40"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {cargando ? (
          <div className="flex items-center gap-3 py-12 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Revisando qué tiene guardado…
          </div>
        ) : estado?.sePuedeBorrar ? (
          <>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              No tiene nada guardado: ni citas, ni fichas, ni fotos. Se puede borrar
              sin que se pierda ningún dato.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Esto no se puede deshacer. Si más adelante vuelve, se crea de nuevo.
            </p>

            {error && (
              <p className="mt-5 rounded-2xl bg-bad-bg px-4 py-3 text-sm text-bad">{error}</p>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onCerrar}
                disabled={trabajando}
                className="btn-outline sm:flex-1"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void borrar()}
                disabled={trabajando}
                className="btn bg-bad text-white hover:bg-bad sm:flex-1"
              >
                {trabajando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    Sí, borrarlo
                  </>
                )}
              </button>
            </div>
          </>
        ) : estado ? (
          <>
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-warn/30 bg-warn-bg p-4">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-warn"
                strokeWidth={2}
                aria-hidden
              />
              <div className="min-w-0 text-sm text-brand-900">
                <p className="font-medium">Este paciente no se puede borrar.</p>
                <p className="mt-1 leading-relaxed">Tiene guardado:</p>
                <ul className="mt-2 space-y-1">
                  {estado.resumen.map((linea) => (
                    <li key={linea} className="flex gap-2">
                      <span aria-hidden>·</span>
                      {linea}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-muted">
              Borrarlo se llevaría por delante sus fotos, sus fichas y sus consentimientos
              firmados, que es justo lo que respalda al centro si algún día hay un reclamo.
            </p>

            {estado.activo ? (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Si lo que quieres es que deje de aparecer en la lista, márcalo como inactivo: se
                guarda todo y deja de estorbar.
              </p>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Ya está marcado como inactivo, así que no aparece en el día a día.
              </p>
            )}

            {error && (
              <p className="mt-5 rounded-2xl bg-bad-bg px-4 py-3 text-sm text-bad">{error}</p>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={onCerrar}
                disabled={trabajando}
                className="btn-outline sm:flex-1"
              >
                {estado.activo ? 'Cancelar' : 'Entendido'}
              </button>
              {estado.activo && (
                <button
                  type="button"
                  onClick={() => void archivar()}
                  disabled={trabajando}
                  className="btn-primary sm:flex-1"
                >
                  {trabajando ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <>
                      <Archive className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                      Marcar inactivo
                    </>
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 rounded-2xl bg-bad-bg px-4 py-3 text-sm text-bad">
              {error ?? 'No pudimos revisar el paciente.'}
            </p>
            <button type="button" onClick={onCerrar} className="btn-outline mt-6 w-full">
              Cerrar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
