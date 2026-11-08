import Image from 'next/image';
import Link from 'next/link';
import { BellRing, CalendarCheck, FileText, MessageCircle } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { PORTADA, SITE } from '@/lib/config';

interface HeroProps {
  whatsappLink: string;
  /** Foto del consultorio subida desde el panel. Sin ella, el arco dibujado. */
  imageUrl?: string;
  /** Horarios libres en los próximos 7 días. Null si no se pudo calcular. */
  huecosDeLaSemana: number | null;
}

/**
 * La portada.
 *
 * El titular dice lo que el centro promete —calma y orden—, la entrada
 * explica cómo se cumple, y debajo hay un dato vivo: cuántos horarios quedan
 * esta semana, calculado de la misma agenda que decide las reservas. No es un
 * contador decorativo: si la semana está llena, lo dice.
 *
 * La imagen va dentro de un arco, la forma que repite el sitio. Mientras no
 * haya foto del consultorio, el arco lleva una ilustración abstracta con la
 * etiqueta de que ahí va la foto real.
 */
export function Hero({ whatsappLink, imageUrl, huecosDeLaSemana }: HeroProps) {
  const agenda =
    huecosDeLaSemana === null
      ? { titulo: 'Agenda abierta', detalle: 'Confirmación inmediata y recordatorio la víspera.' }
      : huecosDeLaSemana === 0
        ? { titulo: 'Esta semana ya está llena', detalle: 'Reserve para la próxima: los horarios se abren cada día.' }
        : {
            titulo: `${huecosDeLaSemana} horario${huecosDeLaSemana === 1 ? '' : 's'} libre${huecosDeLaSemana === 1 ? '' : 's'} esta semana`,
            detalle: 'Confirmación inmediata y recordatorio la víspera.',
          };

  return (
    <section
      aria-labelledby="hero-titulo"
      className="relative overflow-hidden pb-[clamp(72px,8vw,112px)] pt-[clamp(40px,6vw,84px)] [background:radial-gradient(760px_520px_at_88%_8%,rgb(var(--accent-400)/0.22),transparent_62%),radial-gradient(700px_520px_at_-5%_105%,rgb(var(--brand-600)/0.10),transparent_60%),linear-gradient(180deg,#fff_0%,#fbfaf8_100%)]"
    >
      {/* Arcos finos de fondo: decorativos. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(#000_30%,transparent_80%)]">
        <span className="absolute -right-[170px] top-2.5 h-[1040px] w-[760px] rounded-t-full border border-brand-700/[0.07]" />
        <span className="absolute -right-[90px] top-[92px] h-[880px] w-[600px] rounded-t-full border border-brand-700/[0.07]" />
        <span className="absolute -right-2.5 top-[172px] h-[720px] w-[440px] rounded-t-full border border-accent-400/[0.16]" />
      </div>

      <div className="shell relative grid grid-cols-[minmax(0,1fr)] items-center gap-[clamp(32px,5vw,72px)] lg:grid-cols-2">
        <div>
          <Reveal>
            <span className="eyebrow">
              {PORTADA.etiqueta} · {SITE.city}
            </span>
          </Reveal>
          <Reveal delay={90}>
            <h1 id="hero-titulo" className="mt-[22px] text-[clamp(2.7rem,5.6vw,4.7rem)] leading-[1.02] tracking-[-0.025em]">
              {PORTADA.titulo} <em className="font-normal italic text-brand-600">{PORTADA.tituloResaltado}</em>
            </h1>
          </Reveal>
          <Reveal delay={180}>
            <p className="lead mt-6 max-w-[520px]">{PORTADA.entrada}</p>
          </Reveal>
          <Reveal delay={270}>
            <div className="mt-[34px] flex flex-wrap gap-3">
              <Link href="/reservar" className="btn-primary">
                <CalendarCheck className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                Reservar una cita
              </Link>
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-outline">
                <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                Escribir por WhatsApp
              </a>
            </div>
          </Reveal>
          <Reveal delay={360}>
            <div className="mt-11 flex max-w-[520px] items-center gap-4 border-t border-line pt-7">
              <div className="flex" aria-hidden>
                {['LM', 'JR', 'PA', 'CT'].map((ini, i) => (
                  <span
                    key={ini}
                    className={`avatar -ml-3 h-10 w-10 border-[2.5px] border-white text-[13px] shadow-[0_4px_10px_-6px_rgb(var(--ink)/0.5)] first:ml-0 ${
                      ['bg-brand-100 text-brand-700', 'bg-accent-100 text-accent-700', 'bg-[#E8EAF1] text-[#3B4A6B]', 'bg-[#EFE8E3] text-[#6B4E3D]'][i]
                    }`}
                  >
                    {ini}
                  </span>
                ))}
              </div>
              <div>
                <b className="flex items-center gap-2.5 text-[15px] font-semibold">
                  <span
                    aria-hidden
                    className={`inline-block h-2 w-2 flex-none rounded-full ${
                      huecosDeLaSemana === 0 ? 'bg-warn shadow-[0_0_0_4px_rgb(var(--warn-bg))]' : 'bg-ok shadow-[0_0_0_4px_rgb(var(--ok-bg))]'
                    }`}
                  />
                  {agenda.titulo}
                </b>
                <span className="mt-0.5 block text-sm text-muted">{agenda.detalle}</span>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="relative w-full max-w-[560px] lg:max-w-none lg:pl-[9%]">
          <Reveal variant="scale">
            <div className="relative aspect-[4/3.8] w-full overflow-hidden rounded-t-full rounded-b-[20px] shadow-[0_2px_6px_rgb(var(--ink)/0.08),0_40px_80px_-40px_rgb(var(--ink)/0.65)] sm:aspect-[4/5] sm:rounded-b-[28px]">
              {imageUrl ? (
                <Image src={imageUrl} alt={`Consultorio de ${SITE.name}`} fill priority sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
              ) : (
                <>
                  <ArcoIlustrado />
                  <span className="absolute bottom-6 left-1/2 z-[2] inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-white/10 px-3 py-[7px] text-[12.5px] font-medium text-white backdrop-blur">
                    Aquí va una foto real del consultorio
                  </span>
                </>
              )}
              <span aria-hidden className="pointer-events-none absolute inset-2.5 z-[1] rounded-t-full rounded-b-xl border border-white/20 sm:inset-3.5 sm:rounded-b-[18px]" />
            </div>
          </Reveal>

          <Reveal delay={270} className="absolute left-2.5 top-4 z-[3] sm:left-3 lg:left-0 lg:top-[22%]">
            <div className="flex items-center gap-3 rounded-[14px] border border-white/75 bg-white/85 py-2.5 pl-2.5 pr-3 shadow-[0_2px_4px_rgb(var(--ink)/0.05),0_24px_48px_-24px_rgb(var(--ink)/0.45)] backdrop-blur-md sm:py-[13px] sm:pl-[13px] sm:pr-4">
              <span className="icon-box tone-ok h-[38px] w-[38px] rounded-[10px]">
                <BellRing className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
              </span>
              <div>
                <b className="block text-sm font-semibold leading-snug">Recordatorio enviado</b>
                <span className="block text-[12.5px] text-muted">Su cita es mañana, 9:15 am</span>
              </div>
            </div>
          </Reveal>
          <Reveal delay={360} className="absolute bottom-[20%] right-3 z-[3] hidden sm:block lg:-right-[5%]">
            <div className="flex items-center gap-3 rounded-[14px] border border-white/75 bg-white/85 py-[13px] pl-[13px] pr-4 shadow-[0_2px_4px_rgb(var(--ink)/0.05),0_24px_48px_-24px_rgb(var(--ink)/0.45)] backdrop-blur-md">
              <span className="icon-box tone-sand h-[38px] w-[38px] rounded-[10px]">
                <FileText className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
              </span>
              <div>
                <b className="block text-sm font-semibold leading-snug">Expediente al día</b>
                <span className="block text-[12.5px] text-muted">Notas, medicación y fotos</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/** Ilustración del arco mientras no hay foto: luz cálida sobre azul profundo. */
function ArcoIlustrado() {
  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="arco-cielo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2B5283" />
          <stop offset="55%" stopColor="rgb(31 58 95)" />
          <stop offset="100%" stopColor="rgb(19 35 59)" />
        </linearGradient>
        <radialGradient id="arco-luz" cx="0.72" cy="0.18" r="0.6">
          <stop offset="0%" stopColor="#E9D9BE" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#C9AE85" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#C9AE85" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="500" fill="url(#arco-cielo)" />
      <rect width="400" height="500" fill="url(#arco-luz)" />
      <g fill="none" stroke="#fff" strokeOpacity="0.08">
        <path d="M-20 380 Q 120 300 220 360 T 440 330" />
        <path d="M-20 410 Q 140 340 240 390 T 440 365" />
        <path d="M-20 440 Q 160 380 260 420 T 440 400" />
      </g>
      <rect x="250" y="120" width="70" height="120" rx="35" fill="#fff" fillOpacity="0.06" />
      <rect x="262" y="132" width="46" height="96" rx="23" fill="none" stroke="#C9AE85" strokeOpacity="0.35" />
    </svg>
  );
}
