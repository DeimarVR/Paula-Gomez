'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, UserRound, X } from 'lucide-react';
import { Logo } from './Logo';
import { ScrollProgress } from './ScrollProgress';
import { NAV_LINKS } from '@/lib/config';

interface HeaderProps {
  whatsappLink: string;
}

/**
 * La cabecera del sitio, como en la maqueta: vidrio claro que se vuelve
 * sólido al bajar, la marca a la izquierda y dos acciones a la derecha
 * —«Ingresar» para el equipo y «Reservar cita» para el paciente—.
 *
 * En el celular la navegación se pliega en un menú; «Reservar cita» se queda
 * siempre a la vista, porque es a lo que viene casi todo el mundo.
 */
export function Header({ whatsappLink }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Cierra el menú al navegar a otra página.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const alPulsar = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [menuOpen]);

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl backdrop-saturate-150 transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled || menuOpen
          ? 'border-line bg-surface/95 shadow-[0_10px_30px_-24px_rgb(var(--ink)/0.45)]'
          : 'border-transparent bg-surface/70'
      }`}
    >
      <ScrollProgress />

      <div className="shell flex h-[72px] items-center justify-between gap-4 sm:h-[78px] sm:gap-6">
        <Link href="/" aria-label="Inicio" className="min-w-0">
          <Logo conLema lemaSoloEnPantallaAncha />
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Principal">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative px-3.5 py-2.5 text-[15px] font-medium text-muted transition-colors hover:text-ink"
            >
              {link.label}
              <span
                aria-hidden
                className="absolute inset-x-3.5 bottom-[5px] h-[1.5px] origin-left scale-x-0 rounded bg-accent-400 transition-transform duration-200 group-hover:scale-x-100"
              />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <Link href="/admin" className="btn-outline btn-sm hidden lg:inline-flex">
            <UserRound className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Ingresar
          </Link>
          <Link href="/reservar" className="btn-primary btn-sm px-3 sm:px-3.5">
            Reservar cita
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="menu-movil"
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="grid h-11 w-11 place-items-center rounded-[10px] border border-line bg-surface lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
      </div>

      <div
        id="menu-movil"
        hidden={!menuOpen}
        className="absolute inset-x-0 top-full border-b border-line bg-surface shadow-soft lg:hidden"
      >
        <nav className="shell flex flex-col py-3" aria-label="Principal (menú)">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="rounded-lg px-3 py-3.5 text-base font-medium text-ink hover:bg-cream"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-3 grid gap-2.5 border-t border-line pb-2 pt-4 sm:grid-cols-2">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-outline w-full">
              Escribir por WhatsApp
            </a>
            <Link href="/admin" className="btn-outline w-full">
              <UserRound className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              Ingresar
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
