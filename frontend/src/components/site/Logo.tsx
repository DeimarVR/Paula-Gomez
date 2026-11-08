import { SITE } from '@/lib/config';

interface LogoProps {
  className?: string;
  /** `light` pinta el nombre en blanco, para el pie y otros fondos oscuros. */
  variant?: 'dark' | 'light';
  /** `sm` para la barra del panel y el celular; `md` para la cabecera del sitio. */
  size?: 'sm' | 'md';
  /** Muestra el lema debajo del nombre. */
  conLema?: boolean;
  /** En el celular no cabe: se esconde por debajo de `sm`. */
  lemaSoloEnPantallaAncha?: boolean;
}

/**
 * La marca del centro, tal como la dibuja la maqueta «Sereno clínico».
 *
 * Mientras no llegue el logo del cliente, la marca es un cuadro azul con una
 * cruz y un punto arena, más el nombre en Newsreader. Es deliberadamente
 * sobria: se ve terminada sin pretender ser una identidad que todavía no
 * existe.
 *
 * Cuando el cliente entregue su logo, este es el único archivo que cambia: se
 * reemplaza el cuadro por su `<Image>` y todo el sitio y el panel lo heredan.
 * Ver ADAPTAR.md.
 */
export function Logo({
  className = '',
  variant = 'dark',
  size = 'md',
  conLema = false,
  lemaSoloEnPantallaAncha = false,
}: LogoProps) {
  const claro = variant === 'light';

  return (
    <span className={`inline-flex min-w-0 max-w-full items-center gap-2.5 sm:gap-3 ${className}`}>
      <LogoMark size={size === 'sm' ? 34 : 40} />
      <span className="min-w-0">
        {/* Un nombre largo no puede empujar los botones de la cabecera: se corta. */}
        <span
          className={`block truncate font-display font-medium leading-tight tracking-[-0.01em] ${
            size === 'sm' ? 'text-[1.2rem]' : 'text-[1.25rem] sm:text-[1.45rem]'
          } ${claro ? 'text-white' : 'text-ink'}`}
        >
          {SITE.name}
        </span>
        {conLema && (
          <span
            className={`mt-1 text-xs font-medium tracking-[0.02em] ${
              lemaSoloEnPantallaAncha ? 'hidden sm:block' : 'block'
            } ${
              claro ? 'text-on-deep-muted' : 'text-subtle'
            }`}
          >
            {SITE.tagline}
          </span>
        )}
      </span>
    </span>
  );
}

/** Solo el cuadro, sin el nombre: para la barra plegada y los espacios estrechos. */
export function LogoMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`brand-mark ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28) }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth={2.4}
        strokeLinecap="round"
        style={{ width: size / 2, height: size / 2 }}
      >
        <path d="M12 5.5v13M5.5 12h13" />
        <circle cx="19" cy="5" r="1.9" fill="rgb(var(--accent-400))" stroke="none" />
      </svg>
    </span>
  );
}
