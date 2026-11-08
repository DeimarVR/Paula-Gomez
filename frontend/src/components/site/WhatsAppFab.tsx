'use client';

import { useEffect, useState } from 'react';

interface WhatsAppFabProps {
  href: string;
}

/**
 * Botón flotante de WhatsApp.
 *
 * Usa un enlace wa.me, así que funciona sin ningún token ni configuración de
 * Meta. Aparece después de un poco de scroll para no tapar el hero.
 *
 * Cerrado es un círculo exacto: el icono vive en un cuadrado de 3.5rem y el
 * rótulo empieza con ancho cero. Antes el rótulo oculto seguía sumando su
 * separación y dejaba el icono descentrado dentro de una pastilla.
 *
 * La animación de flote va en el enlace y la de aparición en el contenedor de
 * fuera. Si compartieran elemento, la animación pisaría el `transform` de la
 * transición y el botón entraría a saltos.
 */
export function WhatsAppFab({ href }: WhatsAppFabProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-5 right-5 z-40 transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      }`}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escribir por WhatsApp"
        className="relative flex h-[52px] items-center gap-2.5 rounded-full bg-ink pl-4 pr-4 text-[15px] font-semibold text-white shadow-[0_2px_4px_rgb(var(--ink)/0.1),0_20px_40px_-16px_rgb(var(--ink)/0.6)] transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-brand-700 sm:pr-5"
      >
        <span className="relative grid shrink-0 place-items-center">
          <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] fill-current" aria-hidden>
            <path d="M12.04 2C6.6 2 2.17 6.43 2.17 11.87c0 1.74.46 3.44 1.32 4.94L2 22l5.34-1.4a9.86 9.86 0 0 0 4.7 1.2h.01c5.43 0 9.86-4.43 9.86-9.87 0-2.64-1.03-5.12-2.9-6.98A9.8 9.8 0 0 0 12.05 2Zm0 18.06h-.01c-1.5 0-2.97-.4-4.25-1.16l-.3-.18-3.16.83.84-3.09-.2-.32a8.16 8.16 0 0 1-1.25-4.36c0-4.52 3.68-8.2 8.2-8.2 2.2 0 4.25.86 5.8 2.41a8.15 8.15 0 0 1 2.4 5.8c0 4.52-3.68 8.2-8.2 8.2Z" />
            <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15s-.77.96-.94 1.16-.35.22-.65.07a8.2 8.2 0 0 1-2.4-1.48 9.1 9.1 0 0 1-1.68-2.09c-.17-.3 0-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.38-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
          </svg>
        </span>
        {/* En el celular solo el icono: el texto se queda para el lector de pantalla. */}
        <span className="sr-only sm:not-sr-only">WhatsApp</span>
      </a>
    </div>
  );
}
