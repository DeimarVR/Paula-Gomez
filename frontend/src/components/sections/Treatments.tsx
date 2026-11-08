import Link from 'next/link';
import { ArrowRight, CalendarCheck, Check, Clock } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { ServiceIcon } from '@/components/ui/ServiceIcon';
import { CITA } from '@/lib/agenda';
import { formatDuration } from '@/lib/format';
import type { Service } from '@/lib/types';

interface TreatmentsProps {
  services: Service[];
}

/** Cuántos servicios caben en el mosaico además de la consulta. */
const EN_EL_MOSAICO = 4;

/**
 * Servicios, en mosaico.
 *
 * La pieza grande es la consulta: es lo único que se reserva por internet y
 * la puerta a todo lo demás. Las pequeñas son los servicios publicados en el
 * panel (Tratamientos), los destacados primero. Cada una lleva a su página,
 * y desde ahí a reservar la consulta.
 */
export function Treatments({ services }: TreatmentsProps) {
  const ordenados = [...services].sort(
    (a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder,
  );
  const visibles = ordenados.slice(0, EN_EL_MOSAICO);
  const resto = ordenados.length - visibles.length;

  return (
    <section id="servicios" aria-labelledby="servicios-titulo" className="py-[clamp(72px,9vw,120px)]">
      <div className="shell">
        <Reveal>
          <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-[640px]">
              <span className="eyebrow">Servicios</span>
              <h2 id="servicios-titulo" className="mt-3.5 text-[clamp(2rem,3.4vw,2.85rem)] leading-[1.12]">
                Atención pensada para <em className="font-normal italic text-brand-600">cada etapa</em> de su tratamiento
              </h2>
              <p className="lead mt-4 max-w-[560px]">
                Desde la primera valoración hasta los controles: cada visita queda registrada para dar
                continuidad a su proceso.
              </p>
            </div>
            <Link href="/reservar" className="link-arrow">
              Ver disponibilidad <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            </Link>
          </div>
        </Reveal>

        <div className="grid auto-rows-[minmax(250px,auto)] grid-cols-[minmax(0,1fr)] gap-[18px] md:grid-cols-2 lg:grid-cols-4">
          <Reveal variant="scale" className="md:col-span-2 lg:row-span-2">
            <article className="grain relative flex h-full min-h-[420px] flex-col justify-end gap-3.5 overflow-hidden rounded-[22px] p-6 pt-48 text-on-deep sm:p-[38px] md:min-h-[480px] lg:min-h-[540px] [background:linear-gradient(160deg,#2a5181_0%,rgb(var(--brand-700))_38%,rgb(var(--brand-900))_100%)]">
              <svg viewBox="0 0 400 400" aria-hidden className="pointer-events-none absolute -right-12 -top-14 h-[300px] w-[300px] sm:h-[400px] sm:w-[400px]">
                <circle cx="200" cy="200" r="180" fill="none" stroke="#C9AE85" strokeOpacity="0.25" />
                <circle cx="200" cy="200" r="130" fill="none" stroke="#fff" strokeOpacity="0.08" />
                <circle cx="200" cy="200" r="80" fill="rgb(201 174 133 / 0.12)" />
                <path d="M200 160v80M160 200h80" stroke="#fff" strokeOpacity="0.5" strokeWidth="6" strokeLinecap="round" />
              </svg>
              <span className="eyebrow-deep relative">Primera visita y controles</span>
              <h3 className="relative mt-1 text-[clamp(2rem,2.8vw,2.6rem)] leading-[1.08] text-white">
                {CITA.nombre} con la especialista
              </h3>
              <p className="relative max-w-[440px] text-base text-on-deep-muted">
                Revisión completa de su caso, sus antecedentes y lo que espera lograr. Sale con un plan
                claro, por escrito.
              </p>
              <ul className="relative mt-1.5 grid gap-2.5">
                {['Revisión de antecedentes y medicación', 'Plan de tratamiento por escrito', 'Se abre su expediente digital'].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-[15px] text-on-deep">
                    <Check className="h-[18px] w-[18px] text-accent-400" strokeWidth={2} aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <div className="relative mt-[18px] flex flex-wrap items-center gap-[18px]">
                <Link href="/reservar" className="btn-on-dark">
                  <CalendarCheck className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                  Reservar consulta
                </Link>
                <span className="inline-flex items-center gap-1.5 text-sm text-on-deep-muted">
                  <Clock className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  {CITA.duracionMin} minutos, una persona a la vez
                </span>
              </div>
            </article>
          </Reveal>

          {visibles.map((service, indice) => (
            <Reveal key={service.id} delay={((indice % 2) + 1) * 90} className="h-full">
              <Link
                href={`/servicios/${service.slug}`}
                className="group relative flex h-full flex-col gap-2.5 overflow-hidden rounded-[22px] border border-line bg-surface p-[22px] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-[3px] hover:border-[#D3DCE7] hover:shadow-soft sm:p-[26px]"
              >
                <div className="flex items-start justify-between">
                  <span className="icon-box h-[50px] w-[50px] rounded-[14px] text-brand-700 shadow-[inset_0_0_0_1px_rgb(var(--brand-700)/0.08),0_6px_14px_-10px_rgb(var(--brand-700)/0.6)] [background:linear-gradient(150deg,#fff,rgb(var(--brand-100)))]">
                    <ServiceIcon name={service.icon} className="h-[22px] w-[22px]" />
                  </span>
                  <span className="font-display text-[1.15rem] italic text-accent-700">
                    {String(indice + 2).padStart(2, '0')}
                  </span>
                </div>
                <h3 className="mt-3 text-[1.4rem]">{service.name}</h3>
                <p className="text-[15px] leading-[1.55] text-muted">{service.shortDesc}</p>
                <div className="mt-auto flex items-center justify-between gap-2.5 pt-3.5 text-sm text-subtle">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                    {service.sessionsAdvice ? `${service.sessionsAdvice} sesiones` : formatDuration(service.durationMin)}
                  </span>
                  <span className="link-arrow">
                    Ver <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  </span>
                </div>
                <span
                  aria-hidden
                  className="pointer-events-none absolute -bottom-[60px] -right-[60px] h-[140px] w-[140px] rounded-full bg-[radial-gradient(circle,rgb(var(--accent-400)/0.22),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />
              </Link>
            </Reveal>
          ))}
        </div>

        {resto > 0 && (
          <p className="mt-6">
            <Link href="/servicios" className="link-arrow">
              Ver los {ordenados.length} servicios <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}
