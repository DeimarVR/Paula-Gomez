import type { Metadata } from 'next';
import Link from 'next/link';
import { Results } from '@/components/sections/Results';
import { CallToAction } from '@/components/sections/CallToAction';
import { getClinic } from '@/lib/api';
import { RESULTADOS } from '@/lib/config';

export const metadata: Metadata = {
  title: 'Antes y después',
  description:
    'Casos reales de pacientes de [NOMBRE_CLÍNICA], [CIUDAD]. Comparaciones antes y después publicadas con autorización firmada.',
};

export const revalidate = 600;

export default async function ResultadosPage() {
  const clinic = await getClinic();

  return (
    <>
      <section className="pt-10 sm:pt-14">
        <div className="shell">
          <div className="max-w-3xl">
            <p className="eyebrow mb-5">Antes y después</p>
            <h1 className="text-4xl leading-tight sm:text-5xl lg:text-6xl">
              Resultados que se pueden comparar
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-muted">
              Todas las fotos se toman en el consultorio, con la misma cámara, el mismo ángulo y la
              misma iluminación. Sin filtros y sin retoque. Si una comparación no cumple esas
              condiciones, no la publicamos.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Cada caso está publicado con la autorización firmada del paciente. Los resultados
              varían según la causa, el tiempo de evolución y la constancia con el tratamiento.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="shell">
          <Results cases={RESULTADOS} showHeader={false} />
        </div>
      </section>

      <div className="shell pb-8">
        <div className="rounded-3xl bg-brand-50 px-8 py-10 text-center">
          <p className="font-display text-xl text-brand-900">
            ¿Quiere ver un caso parecido al suyo?
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-brand-800/80">
            Escríbanos contando su caso y le mostramos casos comparables antes de que decida
            agendar.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href={clinic.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              Consultar por WhatsApp
            </a>
            <Link href="/reservar" className="btn-outline">
              Agendar valoración
            </Link>
          </div>
        </div>
      </div>

      <CallToAction whatsappLink={clinic.whatsappLink} />
    </>
  );
}
