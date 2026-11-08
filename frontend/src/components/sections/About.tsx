import Image from 'next/image';
import { Award, BadgeCheck, BookOpen, GraduationCap, ShieldCheck } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { ESPECIALISTA, PLACEHOLDERS } from '@/lib/config';
import { iniciales } from '@/lib/format';

interface AboutProps {
  /** Retrato de la especialista, subido desde el panel. */
  imageUrl?: string;
}

const ICONOS = [GraduationCap, BookOpen, Award, BadgeCheck];

/**
 * «Quién le atiende».
 *
 * En un consultorio de una sola especialista, saber con quién se va a sentar
 * es lo que decide la cita. El nombre hace de titular; debajo, la
 * especialidad, su presentación en sus palabras, sus credenciales y una frase
 * suya.
 *
 * Sin retrato, el arco lleva sus iniciales grandes y en cursiva: se ve
 * terminado y deja claro dónde va la foto.
 */
export function About({ imageUrl }: AboutProps) {
  const conFoto = imageUrl && imageUrl !== PLACEHOLDERS.team;
  const frase = ESPECIALISTA.frase.trim();

  return (
    <section
      id="especialista"
      aria-labelledby="especialista-titulo"
      className="overflow-hidden border-y border-line bg-surface py-[clamp(72px,9vw,120px)]"
    >
      <div className="shell grid grid-cols-[minmax(0,1fr)] items-center gap-[clamp(36px,6vw,96px)] lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal variant="left">
          <div className="relative max-w-[460px] pb-4 pr-4 sm:pb-7 sm:pr-7">
            <span aria-hidden className="absolute bottom-0 right-0 h-[68%] w-[72%] rounded-[28px] [background:linear-gradient(160deg,rgb(var(--accent-100)),#EFE6D8)]" />
            <div className="relative z-[1] grid aspect-[4/5] place-items-center overflow-hidden rounded-t-full rounded-b-3xl shadow-[inset_0_0_0_1px_rgb(var(--brand-700)/0.08),0_2px_6px_rgb(var(--ink)/0.06),0_30px_60px_-36px_rgb(var(--ink)/0.55)] [background:radial-gradient(120%_80%_at_50%_0%,#F8FAFD_0%,rgb(var(--brand-50))_40%,#D9E3F0_100%)]">
              {conFoto ? (
                <Image src={imageUrl} alt={ESPECIALISTA.nombre} fill sizes="(min-width: 1024px) 40vw, 100vw" className="object-cover" />
              ) : (
                <>
                  <span aria-hidden className="font-display text-[clamp(5rem,11vw,8.5rem)] font-normal italic leading-none tracking-[-0.04em] text-brand-700/20">
                    {iniciales(ESPECIALISTA.nombre.replace(/[[\]]/g, ''))}
                  </span>
                  <span className="absolute left-1/2 top-11 z-[2] -translate-x-1/2 whitespace-nowrap rounded-full border border-ink/[0.08] bg-white/70 px-3 py-[7px] text-[12.5px] font-medium text-muted">
                    Retrato de la especialista
                  </span>
                </>
              )}
            </div>
            <div className="absolute bottom-[60px] left-2.5 z-[2] flex items-center gap-3 rounded-[14px] border border-white/75 bg-white/85 py-[13px] pl-[13px] pr-4 text-[13px] shadow-[0_24px_48px_-24px_rgb(var(--ink)/0.45)] backdrop-blur-md sm:-left-[18px] sm:bottom-[76px]">
              <span className="icon-box tone-ok h-[38px] w-[38px] rounded-[10px]">
                <ShieldCheck className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
              </span>
              <div>
                <b className="block text-sm">Registro médico</b>
                <span className="text-subtle">Profesional verificada</span>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal variant="right">
          <span className="eyebrow">Quién le atiende</span>
          <h2 id="especialista-titulo" className="mt-3.5 [overflow-wrap:anywhere] text-[clamp(2rem,3.4vw,2.85rem)] leading-[1.12]">
            {ESPECIALISTA.nombre}
          </h2>
          <p className="mt-2.5 text-base font-medium text-brand-600">{ESPECIALISTA.especialidad}</p>
          <div className="mt-[22px] grid gap-3.5 text-[16.5px] text-muted">
            {ESPECIALISTA.presentacion.map((parrafo) => (
              <p key={parrafo.slice(0, 32)}>{parrafo}</p>
            ))}
          </div>
          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {ESPECIALISTA.cargos.map((cargo, indice) => {
              const Icono = ICONOS[indice % ICONOS.length];
              return (
                <li key={cargo} className="flex items-center gap-3 rounded-[14px] border border-line bg-cream p-3.5 text-[14.5px] font-medium">
                  <span className="icon-box h-9 w-9 rounded-[10px] bg-surface text-brand-700 shadow-[inset_0_0_0_1px_rgb(var(--line))]">
                    <Icono className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
                  </span>
                  {cargo}
                </li>
              );
            })}
          </ul>
          {frase && (
            <p className="relative mt-[30px] border-t border-line pl-[54px] pt-[22px] font-display text-[1.35rem] italic leading-[1.45] text-ink">
              <span aria-hidden className="absolute left-0 top-2.5 font-display text-[4.2rem] not-italic leading-none text-accent-400">
                “
              </span>
              {frase}
            </p>
          )}
        </Reveal>
      </div>
    </section>
  );
}
