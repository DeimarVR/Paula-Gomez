import Link from 'next/link';
import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';
import { BeforeAfterSlider } from '@/components/ui/BeforeAfterSlider';
import type { CasoResultado } from '@/lib/config';

interface ResultsProps {
  cases: CasoResultado[];
  /** En la landing se muestran pocos; en /resultados van todos. */
  limit?: number;
  showHeader?: boolean;
}

export function Results({ cases, limit, showHeader = true }: ResultsProps) {
  const visible = limit ? cases.slice(0, limit) : cases;

  const body =
    visible.length === 0 ? (
      <div className="rounded-3xl border border-dashed border-line bg-surface px-8 py-16 text-center">
        <p className="font-display text-xl text-ink">Estamos preparando esta galería</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted">
          Solo publicamos casos de pacientes que firmaron su autorización. Mientras tanto, puede
          pedirnos por WhatsApp casos parecidos al suyo.
        </p>
      </div>
    ) : (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((item, index) => (
          <Reveal key={item.id} delay={index * 70} className="h-full">
            <figure className="card-lift group flex h-full flex-col p-4">
              <BeforeAfterSlider
                beforeUrl={item.beforeUrl}
                afterUrl={item.afterUrl}
                beforeAlt={item.beforeAlt ?? 'Antes del tratamiento'}
                afterAlt={item.afterAlt ?? 'Después del tratamiento'}
              />
              <figcaption className="px-2 pb-1 pt-4">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-display text-lg leading-snug">{item.title}</h3>
                  {item.service && (
                    <span className="mt-0.5 shrink-0 rounded-full bg-brand-50 px-3 py-1 text-[0.65rem] font-medium uppercase tracking-wider text-brand-700">
                      {item.service.name}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
                )}
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  {item.sessionsCount && <span>{item.sessionsCount} sesiones</span>}
                  {item.durationLabel && <span>· {item.durationLabel}</span>}
                </p>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    );

  if (!showHeader) return <>{body}</>;

  return (
    <Section
      id="resultados"
      tone="dark"
      eyebrow="Antes y después"
      title="Resultados de pacientes reales"
      intro="Misma persona, mismo ángulo, misma iluminación. Arrastra el control para comparar. Publicados con autorización firmada."
      aside={
        <Link href="/resultados" className="btn-outline">
          Ver todos los casos
        </Link>
      }
    >
      {body}
    </Section>
  );
}
