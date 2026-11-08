import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CalendarCheck, Clock } from 'lucide-react';
import { ServiceIcon } from '@/components/ui/ServiceIcon';
import { Reveal } from '@/components/ui/Reveal';
import { CallToAction } from '@/components/sections/CallToAction';
import { getClinic, getServices } from '@/lib/api';
import { CITA } from '@/lib/agenda';
import { formatDuration } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Servicios',
  description: 'Los servicios del centro. Todo empieza con una consulta con la especialista.',
};

export const revalidate = 600;

/**
 * Todos los servicios publicados.
 *
 * Se llega desde la portada cuando hay más de los que caben en el mosaico.
 * Arriba se recuerda lo único que se reserva por internet: la consulta.
 */
export default async function ServiciosPage() {
  const [services, clinic] = await Promise.all([getServices(), getClinic()]);
  const ordenados = [...services].sort(
    (a, b) => Number(b.featured) - Number(a.featured) || a.sortOrder - b.sortOrder,
  );

  return (
    <>
      <section className="pb-16 pt-10 sm:pt-14">
        <div className="shell">
          <span className="eyebrow">Servicios</span>
          <h1 className="mt-3.5 max-w-3xl text-[clamp(2.3rem,4.4vw,3.4rem)] leading-[1.06]">
            Todo empieza con <em className="font-normal italic text-brand-600">una consulta</em>
          </h1>
          <p className="lead mt-4 max-w-2xl">
            En la consulta de {CITA.duracionMin} minutos la especialista revisa su caso y le propone el
            plan. Estos son los servicios que puede incluir.
          </p>
          <Link href="/reservar" className="btn-primary mt-7">
            <CalendarCheck className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
            Reservar consulta
          </Link>

          {ordenados.length === 0 ? (
            <p className="mt-12 text-muted">Pronto publicaremos los servicios del centro.</p>
          ) : (
            <ul className="mt-12 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
              {ordenados.map((service, indice) => (
                <li key={service.id}>
                  <Reveal delay={(indice % 3) * 80} className="h-full">
                    <Link
                      href={`/servicios/${service.slug}`}
                      className="group flex h-full flex-col gap-2.5 rounded-[22px] border border-line bg-surface p-6 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-[3px] hover:border-[#D3DCE7] hover:shadow-soft"
                    >
                      <span className="icon-box h-[50px] w-[50px] rounded-[14px] text-brand-700 [background:linear-gradient(150deg,#fff,rgb(var(--brand-100)))] shadow-[inset_0_0_0_1px_rgb(var(--brand-700)/0.08)]">
                        <ServiceIcon name={service.icon} className="h-[22px] w-[22px]" />
                      </span>
                      <h2 className="mt-3 text-[1.35rem]">{service.name}</h2>
                      <p className="text-[15px] leading-[1.55] text-muted">{service.shortDesc}</p>
                      <div className="mt-auto flex items-center justify-between pt-3.5 text-sm text-subtle">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                          {service.sessionsAdvice ? `${service.sessionsAdvice} sesiones` : formatDuration(service.durationMin)}
                        </span>
                        <span className="link-arrow">
                          Ver <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <CallToAction whatsappLink={clinic.whatsappLink} />
    </>
  );
}
