import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, MapPin, MessageCircle } from 'lucide-react';
import { SocialList } from '@/components/site/SocialLinks';
import { ContactForm } from '@/components/site/ContactForm';
import { getClinic, getHorarioPublico } from '@/lib/api';
import { formatPhone } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Contacto',
  description:
    'Escríbanos o visítenos en [CIUDAD]. Horario, ubicación y WhatsApp de [NOMBRE_CLÍNICA].',
};

export default async function ContactoPage() {
  // El horario sale de la misma tabla que decide la agenda: la página nunca
  // dice uno distinto del que se puede reservar.
  const [clinic, horario] = await Promise.all([getClinic(), getHorarioPublico()]);

  return (
    <div className="pb-24 pt-10 sm:pt-14">
      <div className="shell">
        <div className="max-w-2xl">
          <p className="eyebrow mb-5">Hablemos</p>
          <h1 className="text-4xl leading-tight sm:text-5xl">Estamos a un mensaje</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            Resolvemos sus dudas antes de que agende. Escríbanos por WhatsApp para una respuesta
            rápida o déjenos su consulta en el formulario.
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div className="space-y-8">
            <a
              href={clinic.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-5 rounded-3xl bg-brand-900 p-7 text-white transition-transform hover:-translate-y-0.5"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#25D366] text-white">
                <MessageCircle className="h-6 w-6" strokeWidth={1.8} aria-hidden />
              </span>
              <span>
                <span className="block font-display text-lg">WhatsApp</span>
                <span className="mt-1 block text-sm text-brand-200">
                  {formatPhone(clinic.whatsapp)} · respuesta en minutos
                </span>
              </span>
            </a>

            <div className="rounded-3xl border border-line bg-surface p-7">
              <h2 className="flex items-center gap-2.5 font-display text-lg">
                <MapPin className="h-4 w-4 text-brand-600" strokeWidth={1.8} aria-hidden />
                Dónde estamos
              </h2>
              <p className="mt-3 leading-relaxed text-muted">{clinic.address}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `${clinic.name} ${clinic.address}`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-sm font-medium text-brand-700 underline underline-offset-4"
              >
                Abrir en Google Maps
              </a>
            </div>

            <div className="rounded-3xl border border-line bg-surface p-7">
              <h2 className="flex items-center gap-2.5 font-display text-lg">
                <Clock className="h-4 w-4 text-brand-600" strokeWidth={1.8} aria-hidden />
                Horario de atención
              </h2>
              <dl className="mt-4 space-y-3 text-sm">
                {horario.map((fila) => (
                  <div key={fila.dias}>
                    <dt className="font-medium text-ink">{fila.dias}</dt>
                    <dd className="mt-0.5 text-muted">
                      {fila.horas ?? 'Sin atención'}
                      {fila.pausa && <span className="block text-xs text-subtle">{fila.pausa}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="rounded-3xl border border-line bg-surface p-7">
              <h2 className="font-display text-lg">Síganos</h2>
              <p className="mb-4 mt-1 text-sm text-muted">
                Consejos de salud y el día a día del consultorio.
              </p>
              <SocialList whatsappLink={clinic.whatsappLink} />
            </div>
          </div>

          <div>
            <ContactForm whatsappLink={clinic.whatsappLink} />
            <p className="mt-6 text-center text-sm text-muted">
              ¿Prefiere agendar de una vez?{' '}
              <Link href="/reservar" className="font-medium text-brand-700 underline underline-offset-4">
                Reserve su cita en línea
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
