'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarClock, CalendarX, Check, MessageCircle, Phone, RotateCcw, X } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { buildWhatsAppLink, diaDeClave, fechaHoraCorta, formatPhone } from '@/lib/format';
import type { EstadoCierres, EstadoOferta, OfertaHueco } from '@/lib/types';

const ESTADO_OFERTA: Record<EstadoOferta, { clase: string; texto: string }> = {
  ABIERTA: { clase: 'badge-info', texto: 'Esperando respuesta' },
  TOMADA: { clase: 'badge-ok', texto: 'Tomado' },
  VENCIDA: { clase: 'badge-neutral', texto: 'Nadie lo tomó' },
  ANULADA: { clase: 'badge-neutral', texto: 'Se ocupó por otro lado' },
};

/**
 * Lo que la agenda hizo sola y lo que quedó por hacer a mano.
 *
 * Mientras Meta no apruebe las plantillas, los mensajes automáticos no salen:
 * ni la disculpa por un día cerrado ni la oferta de un hueco liberado. Aquí
 * está cada uno con su enlace de WhatsApp ya escrito. Recepción lo toca,
 * WhatsApp se abre con el mensaje completo, lo envía y queda marcado.
 *
 * Cuando las plantillas estén aprobadas esta sección casi siempre estará
 * vacía, y entonces sirve para ver qué pasó con cada hueco ofrecido.
 */
export function PendientesDeAgenda({
  version,
  puedeReabrir,
  onCambio,
}: {
  version: number;
  puedeReabrir: boolean;
  onCambio: () => void;
}) {
  const [cierres, setCierres] = useState<EstadoCierres | null>(null);
  const [ofertas, setOfertas] = useState<OfertaHueco[]>([]);

  const cargar = useCallback(async () => {
    const [c, o] = await Promise.all([
      api.get<EstadoCierres>('/api/cierres').catch(() => null),
      api.get<{ items: OfertaHueco[] }>('/api/ofertas').catch(() => ({ items: [] as OfertaHueco[] })),
    ]);
    setCierres(c);
    setOfertas(o.items);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar, version]);

  async function marcarAviso(id: string) {
    await api.patch(`/api/cierres/avisos/${id}`, {}).catch(() => undefined);
    void cargar();
    onCambio();
  }

  async function marcarInvitacion(id: string) {
    await api.patch(`/api/ofertas/invitaciones/${id}`, {}).catch(() => undefined);
    void cargar();
    onCambio();
  }

  async function reabrir(fecha: string) {
    await api.delete(`/api/cierres/${fecha}`).catch(() => undefined);
    void cargar();
    onCambio();
  }

  const avisos = cierres?.pendientesDeAviso ?? [];
  const esperando = cierres?.pendientesDeReagendar ?? [];
  const dias = cierres?.dias ?? [];
  const ofertasVisibles = ofertas.filter((o) => o.estado === 'ABIERTA' || o.estado === 'TOMADA').slice(0, 6);

  if (!avisos.length && !esperando.length && !dias.length && !ofertasVisibles.length) return null;

  return (
    <div id="pendientes" className="grid scroll-mt-24 gap-6">
      {avisos.length > 0 && (
        <section className="panel-card border-warn/30" aria-labelledby="avisos-titulo">
          <div className="card-head">
            <div>
              <h2 id="avisos-titulo">Disculpas por enviar</h2>
              <p>Citas canceladas al cerrar un día</p>
            </div>
            <span className="badge-warn">{avisos.length}</span>
          </div>
          <ul className="lista">
            {avisos.map((aviso) => (
              <li key={aviso.id} className="flex-wrap">
                {/* En el celular los botones bajan a su propia línea: el nombre se lee entero. */}
                <div className="min-w-0 flex-1 basis-full sm:basis-0">
                  <b className="truncate">{aviso.nombre}</b>
                  <span className="meta">Tenía cita el {fechaHoraCorta(aviso.startsAt)}</span>
                </div>
                {aviso.enlaceManual ? (
                  <a
                    href={aviso.enlaceManual}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void marcarAviso(aviso.id)}
                    className="btn-outline btn-sm"
                  >
                    <MessageCircle className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    Enviar
                  </a>
                ) : (
                  <span className="badge-warn">
                    <Phone strokeWidth={2} aria-hidden />
                    Sin celular
                  </span>
                )}
                <button type="button" onClick={() => void marcarAviso(aviso.id)} className="btn-text">
                  Ya se avisó
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ofertasVisibles.length > 0 && (
        <section className="panel-card" aria-labelledby="ofertas-titulo">
          <div className="card-head">
            <div>
              <h2 id="ofertas-titulo">Huecos ofrecidos</h2>
              <p>A quienes tienen cita más adelante; el primero que lo toma se lo queda</p>
            </div>
          </div>
          <ul className="divide-y divide-line">
            {ofertasVisibles.map((oferta) => (
              <li key={oferta.id} className="px-[22px] py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-[14.5px] font-semibold">
                    <CalendarClock className="h-4 w-4 text-brand-600" strokeWidth={1.8} aria-hidden />
                    {fechaHoraCorta(oferta.startsAt)}
                  </p>
                  <span className={ESTADO_OFERTA[oferta.estado].clase}>
                    {oferta.estado === 'TOMADA' && oferta.tomadaPor
                      ? `Lo tomó ${oferta.tomadaPor}`
                      : ESTADO_OFERTA[oferta.estado].texto}
                  </span>
                </div>
                <ul className="mt-2.5 grid gap-1.5">
                  {oferta.invitaciones.map((inv) => (
                    <li key={inv.id} className="flex flex-wrap items-center gap-2 text-[13.5px]">
                      <span className="min-w-0 flex-1 truncate">
                        {inv.nombre}
                        <span className="text-subtle"> · tenía {fechaHoraCorta(inv.citaActual)}</span>
                      </span>
                      {inv.aceptadaEn ? (
                        <span className="badge-ok">
                          <Check strokeWidth={2.2} aria-hidden />
                          Aceptó
                        </span>
                      ) : inv.rechazadaEn ? (
                        <span className="badge-neutral">
                          <X strokeWidth={2.2} aria-hidden />
                          No le sirve
                        </span>
                      ) : inv.enlaceManual && !inv.enviadaEn ? (
                        <a
                          href={inv.enlaceManual}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => void marcarInvitacion(inv.id)}
                          className="btn-outline btn-sm min-h-8 px-2.5 text-[13px]"
                        >
                          <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                          Enviar
                        </a>
                      ) : inv.enviadaEn ? (
                        <span className="text-xs text-subtle">Enviada</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {esperando.length > 0 && (
        <section className="panel-card" aria-labelledby="esperando-titulo">
          <div className="card-head">
            <div>
              <h2 id="esperando-titulo">Esperando que elijan otra hora</h2>
              <p>Recibieron la disculpa y todavía no reagendan</p>
            </div>
          </div>
          <ul className="lista">
            {esperando.map((p) => (
              <li key={p.id}>
                <div className="min-w-0 flex-1">
                  <b className="truncate">{p.nombre}</b>
                  <span className="meta">
                    {formatPhone(p.telefono)} · era el {fechaHoraCorta(p.startsAt)}
                  </span>
                </div>
                <a
                  href={buildWhatsAppLink(p.telefono)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-text"
                >
                  <MessageCircle className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  Escribir
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dias.length > 0 && (
        <section className="panel-card" aria-labelledby="cerrados-titulo">
          <div className="card-head">
            <div>
              <h2 id="cerrados-titulo">Días cerrados</h2>
              <p>De hoy en adelante</p>
            </div>
          </div>
          <ul className="lista">
            {dias.map((d) => (
              <li key={d.fecha}>
                <span className="icon-box tone-warn h-9 w-9 rounded-[9px]">
                  <CalendarX className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <b className="first-letter:uppercase">{diaDeClave(d.fecha)}</b>
                  {d.motivo && <span className="meta">{d.motivo}</span>}
                </div>
                {puedeReabrir && (
                  <button type="button" onClick={() => void reabrir(d.fecha)} className="btn-text">
                    <RotateCcw className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    Reabrir
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
