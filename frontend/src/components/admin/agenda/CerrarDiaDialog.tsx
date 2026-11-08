'use client';

import { useState } from 'react';
import { CalendarX, Check, Loader2, MessageCircle, TriangleAlert, X } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { ESPECIALISTA } from '@/lib/config';
import { diaDeClave, horaCorta } from '@/lib/format';
import type { AvisoPendiente } from '@/lib/types';

interface Resultado {
  fecha: string;
  motivo: string | null;
  afectadas: AvisoPendiente[];
}

/**
 * «Cerrar este día».
 *
 * Dos pasos en la misma ventana. El primero pregunta, y dice con todas las
 * letras qué va a pasar: cuántas citas se cancelan y que a esas personas les
 * llega una disculpa. El segundo enseña a quién le salió el mensaje solo y a
 * quién hay que escribirle a mano, con el botón ya listo.
 *
 * El motivo es opcional y va en el mensaje. Se dice al lado del campo para que
 * nadie escriba «me voy de rumba» creyendo que es una nota interna.
 */
export function CerrarDiaDialog({
  fecha,
  citasDelDia,
  onCerrar,
  onHecho,
}: {
  fecha: string;
  /** Cuántas citas vivas que todavía no empiezan tiene el día. */
  citasDelDia: number;
  onCerrar: () => void;
  /** Se llama al terminar, para recargar la agenda. */
  onHecho: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [mandadas, setMandadas] = useState<Set<string>>(new Set());

  async function cerrar() {
    setGuardando(true);
    setError(null);
    try {
      const datos = await api.post<Resultado>('/api/cierres', {
        fecha,
        motivo: motivo.trim() || null,
      });
      setResultado(datos);
      onHecho();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cerrar el día');
    } finally {
      setGuardando(false);
    }
  }

  /** Al abrir WhatsApp se da por enviada: es lo que pasa casi siempre. */
  function marcarMandada(id: string) {
    setMandadas((antes) => new Set(antes).add(id));
    void api.patch(`/api/cierres/avisos/${id}`, {}).catch(() => undefined);
  }

  const sinEnviar = resultado?.afectadas.filter((a) => !a.avisoEnviado && !mandadas.has(a.id)) ?? [];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-4 backdrop-blur-sm sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cerrar-dia-titulo"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-lift sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="icon-box tone-warn h-11 w-11 rounded-xl">
              <CalendarX className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <h2 id="cerrar-dia-titulo" className="text-2xl">
                {resultado ? 'Día cerrado' : 'Cerrar este día'}
              </h2>
              <p className="mt-0.5 text-sm text-muted first-letter:uppercase">{diaDeClave(fecha)}</p>
            </div>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="icon-btn shrink-0">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {!resultado ? (
          <>
            <ul className="mt-6 space-y-2.5 text-[15px] leading-relaxed text-ink">
              <li className="flex gap-2.5">
                <Check className="mt-1 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.2} aria-hidden />
                Ese día deja de aceptar citas, desde la web y desde el panel.
              </li>
              <li className="flex gap-2.5">
                <Check className="mt-1 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.2} aria-hidden />
                {citasDelDia === 0 ? (
                  'No hay citas que cancelar.'
                ) : (
                  <span>
                    Se cancela{citasDelDia === 1 ? '' : 'n'}{' '}
                    <strong>
                      {citasDelDia} cita{citasDelDia === 1 ? '' : 's'}
                    </strong>
                    , y a cada persona le llega una disculpa a nombre de {ESPECIALISTA.nombre} con
                    un enlace para elegir otra hora.
                  </span>
                )}
              </li>
              <li className="flex gap-2.5">
                <Check className="mt-1 h-4 w-4 shrink-0 text-brand-600" strokeWidth={2.2} aria-hidden />
                Se puede reabrir después, pero las citas canceladas no vuelven solas.
              </li>
            </ul>

            <div className="mt-6">
              <label htmlFor="cerrar-motivo" className="field-label">
                Motivo <span className="font-normal text-muted">(opcional)</span>
              </label>
              <textarea
                id="cerrar-motivo"
                rows={2}
                maxLength={200}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="field resize-none"
                placeholder="Por ejemplo: congreso médico"
              />
              <p className="mt-1.5 text-xs text-muted">
                {citasDelDia > 0
                  ? 'Va en el mensaje que reciben los pacientes. Si no quieres contarlo, déjalo en blanco.'
                  : 'Queda anotado en la agenda.'}
              </p>
            </div>

            {error && (
              <p role="alert" className="mt-5 flex items-start gap-2 rounded-[10px] bg-bad-bg px-4 py-3 text-sm text-bad">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
                {error}
              </p>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void cerrar()}
                disabled={guardando}
                className="btn sm:flex-1 bg-bad text-white hover:bg-bad/90"
              >
                {guardando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <CalendarX className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                )}
                {citasDelDia > 0 ? `Cerrar y avisar a ${citasDelDia}` : 'Cerrar el día'}
              </button>
              <button type="button" onClick={onCerrar} className="btn-outline sm:flex-1">
                No, dejarlo abierto
              </button>
            </div>
          </>
        ) : (
          <>
            {resultado.afectadas.length === 0 ? (
              <p className="mt-6 text-[15px] text-muted">
                Listo. No había citas que avisar: el día queda cerrado para nuevas reservas.
              </p>
            ) : (
              <>
                <p className="mt-6 text-[15px] text-muted">
                  {sinEnviar.length === 0
                    ? 'Listo. Todas las personas recibieron la disculpa con su enlace para reagendar.'
                    : `A ${sinEnviar.length} ${sinEnviar.length === 1 ? 'persona no le salió' : 'personas no les salió'} el mensaje solo. Toca «Enviar» y WhatsApp se abre con la disculpa ya escrita.`}
                </p>
                <ul className="mt-4 divide-y divide-line rounded-xl border border-line">
                  {resultado.afectadas.map((cita) => {
                    const listo = cita.avisoEnviado || mandadas.has(cita.id);
                    return (
                      <li key={cita.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="w-[68px] flex-none text-sm font-semibold tabular-nums">
                          {horaCorta(cita.startsAt)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{cita.nombre}</span>
                        {listo ? (
                          <span className="badge-ok">
                            <Check strokeWidth={2.2} aria-hidden />
                            Avisado
                          </span>
                        ) : cita.enlaceManual ? (
                          <a
                            href={cita.enlaceManual}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => marcarMandada(cita.id)}
                            className="btn-outline btn-sm"
                          >
                            <MessageCircle className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                            Enviar
                          </a>
                        ) : (
                          <span className="badge-warn">Sin celular: llamar</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <button type="button" onClick={onCerrar} className="btn-primary mt-7 w-full">
              Listo
            </button>
          </>
        )}
      </div>
    </div>
  );
}
