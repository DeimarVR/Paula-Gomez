'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Check, ChevronDown, Clock, Package, Sparkles, User } from 'lucide-react';
import type { ProgressSession, SessionStatus } from '@/lib/types';

interface ProgressTimelineProps {
  sessions: ProgressSession[];
}

const STATUS_STYLE: Record<SessionStatus, { dot: string; label: string; chip: string }> = {
  COMPLETADA: {
    dot: 'bg-brand-600 text-white',
    label: 'Completada',
    chip: 'bg-brand-50 text-brand-700',
  },
  PROGRAMADA: {
    dot: 'bg-cream border-2 border-brand-300 text-brand-500',
    label: 'Programada',
    chip: 'bg-accent-100 text-accent-700',
  },
  REPROGRAMADA: {
    dot: 'bg-cream border-2 border-accent-500 text-accent-700',
    label: 'Reprogramada',
    chip: 'bg-accent-100 text-accent-700',
  },
  CANCELADA: {
    dot: 'bg-line text-muted',
    label: 'Cancelada',
    chip: 'bg-line text-muted',
  },
  NO_ASISTIO: {
    dot: 'bg-line text-muted',
    label: 'No asististe',
    chip: 'bg-line text-muted',
  },
};

/** Línea de tiempo de las sesiones. La más reciente completada abre por defecto. */
export function ProgressTimeline({ sessions }: ProgressTimelineProps) {
  const lastCompleted = [...sessions].reverse().find((item) => item.status === 'COMPLETADA');
  const [openId, setOpenId] = useState<string | null>(lastCompleted?.id ?? null);

  return (
    <ol className="relative space-y-3">
      {/* Riel vertical que conecta los hitos. */}
      <span aria-hidden className="absolute left-[1.1875rem] top-4 bottom-4 w-px bg-line" />

      {sessions.map((session) => {
        const style = STATUS_STYLE[session.status];
        const isOpen = openId === session.id;
        const hasDetail =
          Boolean(session.summary) ||
          Boolean(session.homeCare) ||
          session.photos.length > 0 ||
          session.productsUsed.length > 0;

        return (
          <li key={session.id} className="relative pl-14">
            <span
              className={`absolute left-0 top-3 grid h-10 w-10 place-items-center rounded-full font-display text-sm ${style.dot}`}
            >
              {session.status === 'COMPLETADA' ? (
                <Check className="h-4 w-4" strokeWidth={3} aria-hidden />
              ) : (
                session.sessionNumber
              )}
            </span>

            <div
              className={`rounded-2xl border bg-surface transition-colors ${
                isOpen ? 'border-brand-300' : 'border-line'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpenId(isOpen ? null : session.id)}
                disabled={!hasDetail}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 p-5 text-left disabled:cursor-default"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg">Sesión {session.sessionNumber}</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-medium ${style.chip}`}
                    >
                      {style.label}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                    <Clock className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                    {session.formattedDate}
                  </p>
                </div>

                {hasDetail && (
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-muted transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    strokeWidth={1.8}
                    aria-hidden
                  />
                )}
              </button>

              {isOpen && hasDetail && (
                <div className="space-y-6 border-t border-line px-5 pb-6 pt-5">
                  {session.summary && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-medium text-ink">
                        <Sparkles className="h-4 w-4 text-brand-600" strokeWidth={1.8} aria-hidden />
                        Qué hicimos
                      </h4>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{session.summary}</p>
                    </div>
                  )}

                  {session.homeCare && (
                    <div className="rounded-2xl bg-accent-100/60 p-5">
                      <h4 className="text-sm font-medium text-accent-700">Cuidados en casa</h4>
                      <p className="mt-2 text-sm leading-relaxed text-brand-900/80">
                        {session.homeCare}
                      </p>
                    </div>
                  )}

                  {session.productsUsed.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-medium text-ink">
                        <Package className="h-4 w-4 text-brand-600" strokeWidth={1.8} aria-hidden />
                        Productos aplicados
                      </h4>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {session.productsUsed.map((product) => (
                          <li
                            key={product}
                            className="rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-800"
                          >
                            {product}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {session.metrics && Object.keys(session.metrics).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-ink">Mediciones</h4>
                      <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {Object.entries(session.metrics).map(([key, value]) => (
                          <div key={key} className="rounded-xl bg-brand-50/70 px-4 py-3">
                            <dt className="text-xs capitalize text-muted">
                              {key.replace(/_/g, ' ')}
                            </dt>
                            <dd className="mt-0.5 font-display text-lg text-brand-800">
                              {String(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {session.photos.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-ink">Registro fotográfico</h4>
                      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {session.photos.map((photo) => (
                          <figure
                            key={photo.id}
                            className="relative aspect-square overflow-hidden rounded-xl bg-brand-100"
                          >
                            <Image
                              src={photo.url}
                              alt={photo.caption ?? `Registro ${photo.angle}`}
                              fill
                              sizes="(min-width: 640px) 20vw, 33vw"
                              className="object-cover"
                            />
                            <figcaption className="absolute inset-x-0 bottom-0 bg-brand-900/70 px-2 py-1 text-[0.6rem] capitalize text-white">
                              {photo.angle}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  )}

                  {session.professional && (
                    <p className="flex items-center gap-2 border-t border-line pt-4 text-xs text-muted">
                      <User className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                      Atendida por {session.professional}
                    </p>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
