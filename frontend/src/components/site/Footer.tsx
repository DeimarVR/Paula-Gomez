import Link from 'next/link';
import { Logo } from './Logo';
import { SocialLinks } from './SocialLinks';
import { LEGAL, SITE, legalCompleto } from '@/lib/config';
import { formatPhone } from '@/lib/format';
import type { FilaDeHorario } from '@/lib/api';
import type { Clinic } from '@/lib/types';

interface FooterProps {
  clinic: Clinic;
  /** El horario de la base, el mismo de la agenda. */
  horario: FilaDeHorario[];
}

/**
 * El pie, sobre el azul profundo.
 *
 * El horario sale de la base, no de una lista escrita aquí: antes había una a
 * mano y bastaba con cambiar el horario en el panel para que el pie mintiera.
 * El nombre del centro va al fondo en letras enormes y huecas: es la firma
 * de la maqueta, decorativa y oculta a los lectores de pantalla.
 */
export function Footer({ clinic, horario }: FooterProps) {
  const year = new Date().getFullYear();
  const enlace = 'inline-block py-1.5 text-[15px] text-on-deep no-underline hover:text-white hover:underline hover:decoration-accent-400';

  return (
    <footer className="grain relative overflow-hidden bg-brand-900 pt-[72px] text-on-deep">
      <div aria-hidden className="pointer-events-none absolute inset-0 [background:radial-gradient(600px_400px_at_100%_0%,rgb(var(--brand-600)/0.45),transparent_60%)]" />
      <div className="shell relative">
        <div className="grid gap-7 sm:grid-cols-2 sm:gap-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="Inicio">
              <Logo variant="light" />
            </Link>
            <p className="mt-[18px] max-w-[320px] text-[15px] text-on-deep-muted">
              Atención con cita previa, expediente digital y recordatorios por WhatsApp.
            </p>
            <SocialLinks className="mt-6" tone="dark" whatsappLink={clinic.whatsappLink} />
          </div>

          <nav aria-labelledby="pie-centro">
            <h2 id="pie-centro" className="font-sans text-[12.5px] font-semibold uppercase tracking-[0.1em] text-accent-400">
              El centro
            </h2>
            <ul className="mt-4 grid gap-1">
              <li><Link href="/#servicios" className={enlace}>Servicios</Link></li>
              <li><Link href="/#especialista" className={enlace}>Quién le atiende</Link></li>
              <li><Link href="/#su-cita" className={enlace}>Su cita</Link></li>
              <li><Link href="/reservar" className={enlace}>Reservar cita</Link></li>
              <li><Link href="/#preguntas" className={enlace}>Preguntas</Link></li>
            </ul>
          </nav>

          <div>
            <h2 className="font-sans text-[12.5px] font-semibold uppercase tracking-[0.1em] text-accent-400">Contacto</h2>
            <ul className="mt-4 grid gap-1">
              <li>
                <a href={clinic.whatsappLink} target="_blank" rel="noopener noreferrer" className={enlace}>
                  {formatPhone(clinic.whatsapp)}
                </a>
              </li>
              <li><Link href="/#visitenos" className={enlace}>{clinic.address}</Link></li>
              {horario
                .filter((fila) => fila.horas)
                .map((fila) => (
                  <li key={fila.dias} className="py-1 text-sm text-on-deep-muted">
                    <span className="block text-on-deep">{fila.dias}</span>
                    {fila.horas}
                  </li>
                ))}
            </ul>
          </div>

          <nav aria-labelledby="pie-legal">
            <h2 id="pie-legal" className="font-sans text-[12.5px] font-semibold uppercase tracking-[0.1em] text-accent-400">
              Legal
            </h2>
            <ul className="mt-4 grid gap-1">
              <li><Link href="/politica-de-datos" className={enlace}>Política de datos</Link></li>
              <li><Link href="/terminos" className={enlace}>Términos y condiciones</Link></li>
              <li><Link href="/cookies" className={enlace}>Cookies</Link></li>
              <li><Link href="/contacto" className={enlace}>Contacto</Link></li>
            </ul>
          </nav>
        </div>

        <div
          aria-hidden
          className="mt-14 select-none whitespace-nowrap text-center font-display text-[clamp(4rem,16vw,14rem)] font-normal leading-[0.78] tracking-[-0.04em] text-transparent [-webkit-text-stroke:1px_rgb(255_255_255/0.09)]"
        >
          {SITE.name}
        </div>

        <div className="flex flex-wrap justify-between gap-3 border-t border-white/10 pb-7 pt-[22px] text-[13.5px] text-on-deep-muted">
          <span>
            © {year} {SITE.name}. Todos los derechos reservados.
          </span>
          {/*
            La identificación jurídica: el nombre comercial no dice a quién le
            reclama un paciente. Mientras no esté cargada en `LEGAL`, no se
            dibuja: el recordatorio vive en config.ts, donde lo lee quien puede
            arreglarlo.
          */}
          {legalCompleto ? (
            <span>
              {LEGAL.razonSocial} · NIT {LEGAL.nit}
            </span>
          ) : null}
          <span className="w-full text-xs text-on-deep-muted/80">
            La información de este sitio es orientativa y no reemplaza una valoración médica presencial.
          </span>
        </div>
      </div>
    </footer>
  );
}
