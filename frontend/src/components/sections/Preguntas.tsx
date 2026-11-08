import { Plus } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { FAQS } from '@/lib/config';

/**
 * Preguntas frecuentes.
 *
 * Con `<details>` y no con un acordeón de JavaScript: se abren sin código,
 * funcionan con teclado y lector de pantalla tal cual, y el buscador del
 * navegador encuentra el texto aunque la respuesta esté cerrada. La primera va
 * abierta para que se entienda que se pueden abrir.
 */
export function Preguntas({ whatsappLink }: { whatsappLink: string }) {
  return (
    <section id="preguntas" aria-labelledby="faq-titulo" className="pb-[clamp(72px,9vw,120px)]">
      <div className="shell grid grid-cols-[minmax(0,1fr)] items-start gap-[clamp(32px,6vw,80px)] lg:grid-cols-[0.8fr_1.2fr]">
        <Reveal className="lg:sticky lg:top-28">
          <span className="eyebrow">Preguntas frecuentes</span>
          <h2 id="faq-titulo" className="mt-3.5 text-[clamp(2rem,3.4vw,2.85rem)] leading-[1.12]">
            Antes de su <em className="font-normal italic text-brand-600">primera visita</em>
          </h2>
          <p className="lead mt-4">
            Si no encuentra su respuesta,{' '}
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 underline">
              escríbanos por WhatsApp
            </a>{' '}
            y le contestamos en horario de atención.
          </p>
        </Reveal>

        <div className="grid gap-2.5">
          {FAQS.map((faq, indice) => (
            <Reveal key={faq.question} delay={Math.min(indice, 4) * 60}>
              <details
                open={indice === 0}
                className="group rounded-2xl border border-line bg-surface transition-[border-color,box-shadow] open:border-[#D3DCE7] open:shadow-[0_1px_2px_rgb(var(--ink)/0.06)]"
              >
                <summary className="flex min-h-[68px] cursor-pointer list-none items-center gap-4 py-4 pl-[22px] pr-[18px] text-[16.5px] font-semibold [&::-webkit-details-marker]:hidden">
                  <span className="min-w-[22px] font-display text-[1.05rem] font-normal italic text-accent-700">
                    {String(indice + 1).padStart(2, '0')}
                  </span>
                  <span className="flex-1">{faq.question}</span>
                  <span
                    aria-hidden
                    className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full border border-line text-muted transition-[background-color,color,border-color,transform] duration-200 group-open:rotate-45 group-open:border-brand-700 group-open:bg-brand-700 group-open:text-white"
                  >
                    <Plus className="h-4 w-4" strokeWidth={2} />
                  </span>
                </summary>
                <p className="max-w-[640px] pb-[22px] pl-[22px] pr-[22px] text-muted sm:pl-[60px]">{faq.answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
