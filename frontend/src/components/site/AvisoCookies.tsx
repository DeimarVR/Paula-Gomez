'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Cookie, X } from 'lucide-react';

/**
 * Aviso de cookies.
 *
 * Hoy este sitio no carga analítica ni publicidad, así que legalmente no haría
 * falta pedir permiso: la única cookie es la de sesión del panel, que está
 * exenta por ser imprescindible para que el panel funcione.
 *
 * Aun así el aviso existe, y se decidió que existiera. Lo que NO se hizo fue
 * copiar el cartel de siempre: un «usamos cookies para mejorar tu experiencia»
 * sería falso aquí, y un botón de «Rechazar» que no apaga nada le enseña a la
 * gente que estos avisos son decorado. Así que el texto dice lo que de verdad
 * pasa, y la decisión se guarda y sirve para algo:
 *
 *   - Si mañana se agrega Google Analytics, el píxel de Meta o un incrustado,
 *     esos scripts consultan `aceptoAnalitica()` ANTES de cargarse. Quien haya
 *     rechazado no los recibe.
 *   - Mientras no exista ninguno, la respuesta simplemente queda registrada.
 *
 * Es la diferencia entre pedir permiso y aparentar que se pide.
 */

const CLAVE = 'clinica.cookies';

type Decision = 'aceptado' | 'rechazado';

/**
 * Qué respondió esta persona. `null` si todavía no respondió.
 *
 * Envuelto en try/catch porque `localStorage` lanza —no devuelve vacío— en
 * navegación privada de algunos navegadores y con las cookies de sitio
 * bloqueadas. Que el visitante tenga el navegador cerrado a cal y canto no
 * puede tumbar la página.
 */
function leerDecision(): Decision | null {
  try {
    const valor = window.localStorage.getItem(CLAVE);
    return valor === 'aceptado' || valor === 'rechazado' ? valor : null;
  } catch {
    return null;
  }
}

/** Para el día que haya algo que cargar. Hoy no lo llama nadie todavía. */
export function aceptoAnalitica(): boolean {
  return leerDecision() === 'aceptado';
}

export function AvisoCookies() {
  /**
   * `null` mientras no se sabe. En el servidor no existe `localStorage`, así
   * que pintar el aviso de entrada haría que el HTML del servidor y el del
   * navegador no coincidan, y React se queja. Se decide ya montado.
   */
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (leerDecision() === null) setVisible(true);
  }, []);

  function responder(decision: Decision) {
    try {
      window.localStorage.setItem(CLAVE, decision);
    } catch {
      // Si no se puede guardar, el aviso volverá a salir en la próxima visita.
      // Molesto, pero preferible a romper la página por esto.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="animar-aviso fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-lift sm:left-6 sm:right-auto sm:bottom-6"
    >
      <div className="flex items-start gap-3">
        <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-accent-500" strokeWidth={1.8} aria-hidden />

        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-ink">
            Este sitio solo usa una cookie técnica, para que el equipo del centro pueda entrar a su
            panel. No hay analítica ni publicidad.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => responder('aceptado')}
              className="btn-primary px-5 py-2 text-sm"
            >
              Aceptar
            </button>
            <button
              type="button"
              onClick={() => responder('rechazado')}
              className="btn-outline px-5 py-2 text-sm"
            >
              Rechazar
            </button>
            <Link
              href="/cookies"
              className="px-2 py-2 text-sm text-muted underline underline-offset-2 transition-colors hover:text-brand-700"
            >
              Más información
            </Link>
          </div>
        </div>

        <button
          type="button"
          onClick={() => responder('rechazado')}
          aria-label="Cerrar el aviso"
          className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-brand-50"
        >
          <X className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        </button>
      </div>
    </div>
  );
}
