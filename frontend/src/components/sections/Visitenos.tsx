import Link from 'next/link';
import { CalendarCheck, Clock, MapPin, MessageCircle, Navigation } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { LogoMark } from '@/components/site/Logo';
import { SITE } from '@/lib/config';
import type { FilaDeHorario } from '@/lib/api';
import type { Clinic } from '@/lib/types';

interface VisitenosProps {
  clinic: Clinic;
  horario: FilaDeHorario[];
  /** Día de la semana de hoy en la zona del centro, 0 = domingo. */
  hoy: number;
}

/** «300 123 4567» a partir de «573001234567». */
function telefonoBonito(numero: string) {
  const d = numero.replace(/\D/g, '');
  const local = d.startsWith('57') && d.length === 12 ? d.slice(2) : d;
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : local;
}

/**
 * «Visítenos»: dirección, WhatsApp y horario, con el mapa al lado.
 *
 * El horario sale de la misma tabla que decide la agenda: si el centro lo
 * cambia en el panel, aquí cambia solo. La fila de hoy va resaltada.
 *
 * El mapa es un marcador hasta tener la dirección real; «Cómo llegar» abre
 * Google Maps con la dirección escrita, que funciona sin configurar nada.
 */
export function Visitenos({ clinic, horario, hoy }: VisitenosProps) {
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${clinic.address} ${SITE.city}`)}`;

  return (
    <section id="visitenos" aria-labelledby="visita-titulo" className="py-[clamp(72px,9vw,120px)]">
      <div className="shell">
        <Reveal>
          <div className="mb-12">
            <span className="eyebrow">Visítenos</span>
            <h2 id="visita-titulo" className="mt-3.5 text-[clamp(2rem,3.4vw,2.85rem)] leading-[1.12]">
              Horarios y <em className="font-normal italic text-brand-600">ubicación</em>
            </h2>
          </div>
        </Reveal>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[1fr_1.15fr]">
          <Reveal>
            <div className="card grid h-full content-start gap-[26px] rounded-[22px] p-[22px] sm:p-8">
              <div className="flex gap-3.5">
                <span className="icon-box tone-info h-11 w-11 rounded-xl">
                  <MapPin className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                </span>
                <div>
                  <b className="block text-[15px]">Dirección</b>
                  <span className="text-[15px] text-muted">
                    {clinic.address}, {SITE.city}
                  </span>
                </div>
              </div>
              <div className="flex gap-3.5">
                <span className="icon-box tone-info h-11 w-11 rounded-xl">
                  <MessageCircle className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                </span>
                <div>
                  <b className="block text-[15px]">WhatsApp</b>
                  <a href={clinic.whatsappLink} target="_blank" rel="noopener noreferrer" className="text-[15px] text-muted hover:text-brand-600">
                    {telefonoBonito(clinic.whatsapp)}
                  </a>
                </div>
              </div>

              {horario.length > 0 && (
                <div>
                  <div className="flex items-center gap-3.5">
                    <span className="icon-box tone-info h-11 w-11 rounded-xl">
                      <Clock className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                    </span>
                    <b>Horario de atención</b>
                  </div>
                  <table className="mt-2.5 w-full border-separate border-spacing-0 text-sm sm:text-[15px]" aria-label="Horario de atención">
                    <tbody>
                      {horario.map((fila, indice) => {
                        const esHoy = fila.numeros.includes(hoy);
                        const borde = indice > 0 && !esHoy && !horario[indice - 1].numeros.includes(hoy) ? 'border-t border-dashed border-line' : '';
                        return (
                          <tr key={fila.dias}>
                            <th scope="row" className={`px-2 py-2.5 text-left font-medium sm:px-3 ${borde} ${esHoy ? 'rounded-l-lg bg-brand-50 font-semibold text-brand-700' : 'text-muted'}`}>
                              {fila.dias}
                              {esHoy && <span className="sr-only"> (hoy)</span>}
                            </th>
                            <td className={`whitespace-nowrap px-2 py-2.5 text-right tabular-nums sm:px-3 ${borde} ${esHoy ? 'rounded-r-lg bg-brand-50 text-brand-700' : ''}`}>
                              {fila.horas ? (
                                <>
                                  <span className="font-semibold">{fila.horas}</span>
                                  {fila.pausa && <span className="block text-xs font-normal text-subtle">{fila.pausa}</span>}
                                </>
                              ) : (
                                <span className="font-medium text-subtle">Cerrado</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap gap-2.5">
                <Link href="/reservar" className="btn-primary">
                  <CalendarCheck className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                  Reservar cita
                </Link>
                <a href={mapa} target="_blank" rel="noopener noreferrer" className="btn-outline">
                  <Navigation className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                  Cómo llegar
                </a>
              </div>
            </div>
          </Reveal>

          <Reveal delay={90}>
            <div className="relative h-full min-h-[320px] overflow-hidden rounded-[22px] border border-line bg-[#EEF1F5] lg:min-h-[460px]" role="img" aria-label="Espacio para el mapa de ubicación">
              <svg viewBox="0 0 600 460" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
                <rect width="600" height="460" fill="#EEF1F5" />
                <g stroke="#fff" strokeWidth="14" fill="none" strokeLinecap="round">
                  <path d="M-20 140 L 620 110" />
                  <path d="M-20 330 L 620 300" />
                  <path d="M160 -20 L 210 480" />
                  <path d="M420 -20 L 460 480" />
                </g>
                <g stroke="#fff" strokeWidth="6" fill="none">
                  <path d="M-20 230 L 620 205" />
                  <path d="M300 -20 L 330 480" />
                </g>
                <rect x="230" y="150" width="70" height="60" rx="6" fill="#E2E7EE" />
                <rect x="340" y="230" width="60" height="50" rx="6" fill="#E2E7EE" />
                <circle cx="315" cy="215" r="52" fill="rgb(31 58 95 / 0.08)" />
                <path d="M315 180c-14 0-24 10-24 23 0 17 24 37 24 37s24-20 24-37c0-13-10-23-24-23z" fill="rgb(31 58 95)" />
                <circle cx="315" cy="203" r="8" fill="#C9AE85" />
              </svg>
              <div className="absolute left-[18px] top-[18px] z-[2] flex max-w-[calc(100%-36px)] items-center gap-3 rounded-[14px] bg-white/95 py-3 pl-3 pr-4 shadow-[0_24px_48px_-24px_rgb(var(--ink)/0.45)]">
                <LogoMark size={38} />
                <div className="min-w-0">
                  <b className="block truncate text-[14.5px]">{clinic.name}</b>
                  <span className="block truncate text-[13px] text-muted">{clinic.address}</span>
                </div>
              </div>
              <span className="absolute bottom-4 right-4 z-[2] rounded-full border border-ink/[0.08] bg-white/70 px-3 py-[7px] text-[12.5px] font-medium text-muted">
                Aquí va el mapa de Google
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
