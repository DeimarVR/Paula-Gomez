import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Clock, Repeat } from 'lucide-react';
import { ServiceIcon } from '@/components/ui/ServiceIcon';
import { Results } from '@/components/sections/Results';
import { CallToAction } from '@/components/sections/CallToAction';
import { getClinic, getService, getServices } from '@/lib/api';
import { formatCop, formatDuration } from '@/lib/format';
import { RESULTADOS } from '@/lib/config';

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const service = await getService(params.slug);
  if (!service) return { title: 'Tratamiento no encontrado' };

  return {
    title: service.name,
    description: service.shortDesc,
    openGraph: { title: service.name, description: service.shortDesc },
  };
}

export async function generateStaticParams() {
  const services = await getServices();
  return services.map((service) => ({ slug: service.slug }));
}

export const revalidate = 600;

export default async function ServicioPage({ params }: PageProps) {
  const [service, clinic, allServices] = await Promise.all([
    getService(params.slug),
    getClinic(),
    getServices(),
  ]);

  if (!service) notFound();

  const related = allServices.filter((item) => item.slug !== service.slug).slice(0, 3);

  /**
   * Los casos ya no vienen adjuntos al servicio: se eligen a mano en
   * `config.ts` y aquí se filtran por el slug del tratamiento.
   */
  const casosDelTratamiento = RESULTADOS.filter((caso) => caso.service?.slug === service.slug);

  return (
    <>
      <section className="pt-10 sm:pt-14">
        <div className="shell">
          <Link
            href="/servicios"
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-brand-700"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Todos los servicios
          </Link>

          <div className="mt-8 grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
            <div>
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
                <ServiceIcon name={service.icon} className="h-6 w-6" />
              </span>

              <h1 className="mt-7 text-4xl leading-tight sm:text-5xl">{service.name}</h1>
              <p className="mt-5 text-lg leading-relaxed text-muted">{service.shortDesc}</p>

              <div className="mt-10 space-y-5 text-[1.0625rem] leading-relaxed text-ink/90">
                {service.description.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>

              {service.benefits.length > 0 && (
                <div className="mt-12">
                  <h2 className="font-display text-xl">Qué esperar de este tratamiento</h2>
                  <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                    {service.benefits.map((benefit) => (
                      <li
                        key={benefit}
                        className="flex items-start gap-3 rounded-2xl bg-brand-50/70 px-5 py-4 text-sm leading-relaxed"
                      >
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-brand-600"
                          strokeWidth={2.5}
                          aria-hidden
                        />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Tarjeta de reserva */}
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-3xl border border-line bg-surface p-8 shadow-soft">
                <p className="text-xs uppercase tracking-wider text-muted">Valor por sesión</p>
                <p className="mt-2 font-display text-4xl text-brand-800">
                  {formatCop(service.priceCop)}
                </p>

                <dl className="mt-7 space-y-4 border-t border-line pt-6 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="inline-flex items-center gap-2 text-muted">
                      <Clock className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                      Duración
                    </dt>
                    <dd className="font-medium">{formatDuration(service.durationMin)}</dd>
                  </div>
                  {service.sessionsAdvice && (
                    <div className="flex items-center justify-between gap-4">
                      <dt className="inline-flex items-center gap-2 text-muted">
                        <Repeat className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                        Protocolo
                      </dt>
                      <dd className="font-medium">
                        {service.sessionsAdvice}{' '}
                        {service.sessionsAdvice === 1 ? 'sesión' : 'sesiones'}
                      </dd>
                    </div>
                  )}
                </dl>

                <Link
                  href={`/reservar?tratamiento=${service.slug}`}
                  className="btn-primary mt-8 w-full group"
                >
                  Reservar este tratamiento
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    strokeWidth={2}
                    aria-hidden
                  />
                </Link>
                <a
                  href={clinic.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline mt-3 w-full"
                >
                  Preguntar por WhatsApp
                </a>

                <p className="mt-6 border-t border-line pt-5 text-xs leading-relaxed text-muted">
                  Todo tratamiento parte de una valoración. Si aún no ha tenido la suya, la primera
                  cita sirve para eso.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {casosDelTratamiento.length > 0 && (
        <section className="py-20 sm:py-24">
          <div className="shell">
            <h2 className="mb-10 text-3xl">Casos con este tratamiento</h2>
            <Results cases={casosDelTratamiento} showHeader={false} />
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="border-t border-line py-20">
          <div className="shell">
            <h2 className="mb-8 text-2xl">Otros tratamientos</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/servicios/${item.slug}`}
                  className="group rounded-2xl border border-line bg-surface p-6 transition-all hover:border-brand-300 hover:shadow-soft"
                >
                  <ServiceIcon name={item.icon} className="h-5 w-5 text-brand-600" />
                  <h3 className="mt-4 text-lg">{item.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.shortDesc}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <CallToAction whatsappLink={clinic.whatsappLink} />
    </>
  );
}
