import Link from 'next/link';
import { CalendarCheck, MessageCircle } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';

interface CallToActionProps {
  whatsappLink: string;
}

/** El cierre de la portada: la misma invitación, en grande y sobre azul. */
export function CallToAction({ whatsappLink }: CallToActionProps) {
  return (
    <section aria-labelledby="cta-titulo" className="pb-[clamp(72px,9vw,120px)]">
      <div className="shell">
        <Reveal variant="scale">
          <div className="grain relative grid items-end gap-10 overflow-hidden rounded-3xl p-[clamp(36px,6vw,80px)] text-white shadow-[0_40px_80px_-48px_rgb(var(--brand-900)/0.8)] md:grid-cols-[minmax(0,1fr)_auto] md:rounded-[32px] [background:linear-gradient(135deg,#2b5283_0%,rgb(var(--brand-700))_42%,rgb(var(--brand-900))_100%)]">
            <svg viewBox="0 0 560 560" aria-hidden className="pointer-events-none absolute -bottom-[150px] -right-20 h-[560px] w-[560px]">
              <circle cx="280" cy="280" r="270" fill="none" stroke="#C9AE85" strokeOpacity="0.2" />
              <circle cx="280" cy="280" r="200" fill="none" stroke="#fff" strokeOpacity="0.06" />
              <circle cx="280" cy="280" r="130" fill="rgb(201 174 133 / 0.08)" />
            </svg>
            <div className="relative">
              <span className="eyebrow-deep">Agenda abierta</span>
              <h2 id="cta-titulo" className="mt-3.5 text-[clamp(2.3rem,4.4vw,3.6rem)] leading-[1.04] tracking-[-0.02em] text-white">
                Su próxima consulta, <em className="font-normal italic text-accent-400">a dos clics.</em>
              </h2>
              <p className="mt-4 max-w-[480px] text-[1.1rem] text-white/80">
                Elija el horario que le sirve y nosotros nos encargamos del resto.
              </p>
            </div>
            <div className="relative flex flex-wrap gap-3 md:flex-nowrap md:justify-end">
              <Link href="/reservar" className="btn-on-dark">
                <CalendarCheck className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                Reservar cita
              </Link>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-on-deep">
                <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                WhatsApp
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
