import type { ReactNode } from 'react';
import { Reveal } from './Reveal';

/**
 * Fondo de la sección: el gris claro de la página, una banda blanca con
 * bordes, o el azul profundo. Cada tono trae su etiqueta y sus colores.
 */
type Tone = 'light' | 'tint' | 'dark';

const TONES: Record<Tone, { wrapper: string; eyebrow: string; title: string; intro: string }> = {
  light: { wrapper: '', eyebrow: 'eyebrow', title: '', intro: 'text-muted' },
  tint: { wrapper: 'border-y border-line bg-surface', eyebrow: 'eyebrow', title: '', intro: 'text-muted' },
  dark: {
    wrapper: 'grain relative overflow-hidden bg-brand-900',
    eyebrow: 'eyebrow-deep',
    title: 'text-white',
    intro: 'text-on-deep-muted',
  },
};

interface SectionProps {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
  /** Alineación de la cabecera. */
  align?: 'left' | 'center';
  className?: string;
  /** Contenido opcional a la derecha de la cabecera (un botón, un enlace). */
  aside?: ReactNode;
  /** Fondo de la sección: crema (por defecto), banda tintada o verde profundo. */
  tone?: Tone;
}

/** Envoltura estándar de sección: espaciado, cabecera y contenedor. */
export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  align = 'left',
  className = '',
  aside,
  tone = 'light',
}: SectionProps) {
  const centered = align === 'center';
  const tones = TONES[tone];

  return (
    <section id={id} className={`py-[clamp(72px,9vw,120px)] ${tones.wrapper} ${className}`}>
      <div className="shell">
        {(eyebrow || title || intro) && (
          <Reveal>
          <div
            className={`mb-12 flex flex-col gap-6 sm:mb-16 ${
              centered
                ? 'items-center text-center'
                : aside
                  ? 'md:flex-row md:items-end md:justify-between'
                  : ''
            }`}
          >
            <div className={centered ? 'max-w-2xl' : 'max-w-2xl'}>
              {eyebrow && <p className={`${tones.eyebrow} mb-3.5`}>{eyebrow}</p>}
              {title && (
                <h2 className={`text-[clamp(2rem,3.4vw,2.85rem)] leading-[1.12] ${tones.title}`}>
                  {title}
                </h2>
              )}
              {intro && <p className={`lead mt-4 ${tones.intro}`}>{intro}</p>}
            </div>
            {aside && <div className="shrink-0">{aside}</div>}
          </div>
          </Reveal>
        )}
        {children}
      </div>
    </section>
  );
}
