import { SOCIAL } from '@/lib/config';

/**
 * Marcas de las redes.
 *
 * Son glifos rellenos, no iconos de trazo: lucide-react no trae TikTok y
 * mezclar un icono de trazo con dos de relleno se nota enseguida. Van con
 * `fill="currentColor"` para que hereden el color de cada contexto.
 */
const GLIFOS: Record<string, string[]> = {
  instagram: [
    'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23a3.7 3.7 0 0 1-.9 1.38 3.7 3.7 0 0 1-1.38.9c-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16ZM12 0C8.74 0 8.33.01 7.05.07c-1.28.06-2.15.26-2.91.56-.79.3-1.46.72-2.13 1.38A5.9 5.9 0 0 0 .63 4.14c-.3.76-.5 1.63-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.28.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13a5.9 5.9 0 0 0 2.13 1.38c.76.3 1.63.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.28-.06 2.15-.26 2.91-.56a5.9 5.9 0 0 0 2.13-1.38 5.9 5.9 0 0 0 1.38-2.13c.3-.76.5-1.63.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.28-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.38-2.13A5.9 5.9 0 0 0 19.86.63c-.76-.3-1.63-.5-2.91-.56C15.67.01 15.26 0 12 0Zm0 5.84a6.16 6.16 0 1 0 0 12.32 6.16 6.16 0 0 0 0-12.32ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm7.85-10.41a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0Z',
  ],
  facebook: [
    'M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07Z',
  ],
  tiktok: [
    'M16.44 0h-3.3v13.32a2.72 2.72 0 0 1-2.71 2.7 2.72 2.72 0 0 1-2.72-2.7 2.73 2.73 0 0 1 2.65-2.71V7.26c-3.3.1-5.95 2.8-5.95 6.06 0 3.34 2.73 6.06 6.08 6.06 3.34 0 6.07-2.72 6.07-6.06V6.4a7.5 7.5 0 0 0 4.32 1.38V4.5c-2.5 0-4.44-2.03-4.44-4.5Z',
  ],
  /*
   * WhatsApp va en dos trazos, no en uno: el auricular tiene que dibujarse
   * encima del globo. En un solo `d` las dos figuras se funden y el auricular
   * desaparece.
   */
  whatsapp: [
    'M12.04 2C6.6 2 2.17 6.43 2.17 11.87c0 1.74.46 3.44 1.32 4.94L2 22l5.34-1.4a9.86 9.86 0 0 0 4.7 1.2h.01c5.43 0 9.86-4.43 9.86-9.87 0-2.64-1.03-5.12-2.9-6.98A9.8 9.8 0 0 0 12.05 2Zm0 18.06h-.01c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.16.83.84-3.09-.2-.32a8.16 8.16 0 0 1-1.25-4.36c0-4.52 3.68-8.2 8.2-8.2 2.2 0 4.25.86 5.8 2.41a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.2-8.2 8.2Z',
    'M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15s-.77.96-.94 1.16-.35.22-.65.07a8.2 8.2 0 0 1-2.4-1.48 9.1 9.1 0 0 1-1.68-2.09c-.17-.3 0-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z',
  ],
};

function Glifo({ nombre, className = 'h-5 w-5' }: { nombre: string; className?: string }) {
  const trazos = GLIFOS[nombre];
  if (!trazos) return null;
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-current`} aria-hidden focusable="false">
      {trazos.map((d) => (
        <path key={d.slice(0, 24)} d={d} />
      ))}
    </svg>
  );
}

interface SocialLinksProps {
  /** Si se pasa, WhatsApp se suma como una red más. */
  whatsappLink?: string;
  /** `dark` es para el pie y las secciones sobre verde profundo. */
  tone?: 'light' | 'dark';
  className?: string;
}

const TONO = {
  light:
    'border-line bg-surface text-brand-700 hover:border-brand-700 hover:bg-brand-700 hover:text-white',
  dark: 'border-white/15 text-on-deep hover:border-accent-400 hover:text-white',
} as const;

/** Fila de accesos a las redes del centro. */
export function SocialLinks({ whatsappLink, tone = 'light', className = '' }: SocialLinksProps) {
  const redes = [
    ...SOCIAL,
    ...(whatsappLink
      ? [{ id: 'whatsapp', label: 'WhatsApp', handle: 'WhatsApp', url: whatsappLink } as const]
      : []),
  ];

  return (
    <ul className={`flex flex-wrap gap-3 ${className}`}>
      {redes.map((red) => (
        <li key={red.id}>
          <a
            href={red.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${red.label} de [NOMBRE_CLÍNICA]`}
            title={red.handle}
            className={`grid h-11 w-11 place-items-center rounded-full border transition-all duration-200 hover:-translate-y-0.5 ${TONO[tone]}`}
          >
            <Glifo nombre={red.id} />
          </a>
        </li>
      ))}
    </ul>
  );
}

/** Los mismos enlaces en lista, con el nombre de usuario visible. */
export function SocialList({ whatsappLink }: { whatsappLink?: string }) {
  const redes = [
    ...SOCIAL,
    ...(whatsappLink
      ? [{ id: 'whatsapp', label: 'WhatsApp', handle: 'Escríbanos', url: whatsappLink } as const]
      : []),
  ];

  return (
    <ul className="grid gap-2.5">
      {redes.map((red) => (
        <li key={red.id}>
          <a
            href={red.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-700 hover:shadow-soft"
          >
            <Glifo nombre={red.id} className="h-5 w-5 text-brand-700" />
            <span>
              <span className="block text-[0.95rem] font-semibold leading-tight">{red.label}</span>
              <span className="block text-sm text-muted">{red.handle}</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
