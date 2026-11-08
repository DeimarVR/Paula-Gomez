import { Reveal } from '@/components/ui/Reveal';
import { iniciales } from '@/lib/format';
import type { Testimonial } from '@/lib/types';

interface TestimonialsProps {
  testimonials: Testimonial[];
}

const TONOS = [
  'bg-accent-100 text-accent-700',
  'bg-brand-100 text-brand-700',
  'bg-[#E8EAF1] text-[#3B4A6B]',
  'bg-[#EFE8E3] text-[#6B4E3D]',
];

/**
 * Opiniones de pacientes.
 *
 * La primera va grande, en arena; las demás, a su lado. Salen del panel
 * (Sitio web → Testimonios) y solo con autorización del paciente: un
 * testimonio inventado en la web de un centro médico es publicidad engañosa.
 * Sin ninguno cargado, la sección no aparece.
 */
export function Testimonials({ testimonials }: TestimonialsProps) {
  if (testimonials.length === 0) return null;
  const [destacado, ...resto] = testimonials;

  return (
    <section aria-labelledby="opiniones-titulo" className="border-y border-line bg-surface py-[clamp(72px,9vw,120px)]">
      <div className="shell">
        <Reveal>
          <div className="mb-12 max-w-[640px]">
            <span className="eyebrow">Pacientes</span>
            <h2 id="opiniones-titulo" className="mt-3.5 text-[clamp(2rem,3.4vw,2.85rem)] leading-[1.12]">
              Lo que dicen <em className="font-normal italic text-brand-600">quienes ya vinieron</em>
            </h2>
          </div>
        </Reveal>

        <div className={`grid grid-cols-[minmax(0,1fr)] gap-5 ${resto.length ? 'lg:grid-cols-[1.25fr_1fr]' : ''}`}>
          <Reveal className={resto.length > 1 ? 'lg:row-span-2' : ''}>
            <figure className="flex h-full flex-col justify-between gap-[18px] rounded-[22px] border border-[#EEE4D3] p-[clamp(30px,4vw,48px)] [background:linear-gradient(160deg,rgb(var(--accent-100))_0%,#FBF8F3_70%)]">
              <div>
                <div aria-hidden className="h-10 font-display text-[5.5rem] leading-[0.7] text-accent-400">
                  “
                </div>
                <blockquote className="font-display text-[clamp(1.55rem,2.5vw,2.1rem)] leading-[1.32] tracking-[-0.012em] text-ink">
                  {destacado.quote}
                </blockquote>
              </div>
              <Firma t={destacado} tono={TONOS[0]} borde="border-[#E8DCC7]" />
            </figure>
          </Reveal>
          {resto.slice(0, 4).map((t, indice) => (
            <Reveal key={t.id} delay={(indice + 1) * 90}>
              <figure className="flex h-full flex-col gap-[18px] rounded-[22px] border border-line bg-surface p-[30px]">
                <blockquote className="font-display text-[1.2rem] leading-normal text-ink">{t.quote}</blockquote>
                <Firma t={t} tono={TONOS[(indice + 1) % TONOS.length]} borde="border-line" />
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Firma({ t, tono, borde }: { t: Testimonial; tono: string; borde: string }) {
  return (
    <figcaption className={`mt-auto flex items-center gap-3 border-t pt-[18px] ${borde}`}>
      <span className={`avatar h-[42px] w-[42px] text-sm ${tono}`} aria-hidden>
        {iniciales(t.authorName)}
      </span>
      <div>
        <b className="block text-[15px]">{t.authorName}</b>
        {t.city && <span className="text-[13.5px] text-subtle">{t.city}</span>}
      </div>
    </figcaption>
  );
}
