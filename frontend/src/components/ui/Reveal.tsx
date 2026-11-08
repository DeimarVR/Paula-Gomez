'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface RevealProps {
  children: ReactNode;
  /** Retardo en milisegundos, para escalonar elementos de una misma fila. */
  delay?: number;
  /** Desde dónde entra. `up` es lo habitual; `scale` para tarjetas grandes. */
  variant?: 'up' | 'left' | 'right' | 'scale';
  className?: string;
}

/** Altura de la línea de disparo: el elemento entra cuando su borde superior la cruza. */
const LINEA = 0.88;

/**
 * Registro compartido de los bloques que todavía no han entrado.
 *
 * Se usa un solo oyente de scroll para toda la página en vez de un
 * IntersectionObserver por bloque, y la razón es un fallo real: el observador
 * solo avisa cuando el elemento CRUZA el umbral. Si el scroll salta de golpe
 * —un ancla, recargar a media página, arrastrar la barra, Fin— el elemento
 * pasa de estar debajo de la ventana a estar encima sin ningún fotograma
 * intermedio, el observador no dispara nunca y la sección se queda invisible
 * para siempre. Medido: saltando de 20 en 20 % quedaban diez bloques en
 * blanco, secciones enteras entre ellos.
 *
 * El barrido comprueba posiciones, no cruces, así que da igual cómo se llegue
 * ahí. Cada bloque se da de baja al entrar y el oyente se retira solo cuando
 * no queda ninguno pendiente, de modo que al final del recorrido no hay nada
 * escuchando.
 */
const pendientes = new Map<Element, () => void>();
let agendado = false;
let escuchando = false;

function barrer() {
  agendado = false;
  const limite = window.innerHeight * LINEA;

  for (const [nodo, mostrar] of pendientes) {
    if (nodo.getBoundingClientRect().top < limite) {
      pendientes.delete(nodo);
      mostrar();
    }
  }

  if (pendientes.size === 0 && escuchando) {
    window.removeEventListener('scroll', agendar);
    window.removeEventListener('resize', agendar);
    escuchando = false;
  }
}

function agendar() {
  if (agendado) return;
  agendado = true;
  requestAnimationFrame(barrer);
}

function registrar(nodo: Element, mostrar: () => void) {
  pendientes.set(nodo, mostrar);

  if (!escuchando) {
    window.addEventListener('scroll', agendar, { passive: true });
    window.addEventListener('resize', agendar, { passive: true });
    escuchando = true;
  }

  agendar();
}

function darDeBaja(nodo: Element) {
  pendientes.delete(nodo);
}

/**
 * Anima la entrada del contenido cuando aparece en pantalla.
 *
 * El estado oculto se aplica solo si el documento tiene la clase `js` (la pone
 * un script en el layout antes del primer pintado). Sin JavaScript el
 * contenido se ve de una vez, en lugar de quedarse invisible para siempre.
 *
 * Si el usuario pidió menos movimiento en su sistema, no se anima nada.
 */
export function Reveal({ children, delay = 0, variant = 'up', className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nodo = ref.current;
    if (!nodo) return;

    // Con "movimiento reducido" tambien se registra: el bloque sigue
    // apareciendo al llegar a el, solo que con un fundido y sin desplazarse.
    // De eso se encarga el CSS, no este componente.
    registrar(nodo, () => setVisible(true));
    return () => darDeBaja(nodo);
  }, []);

  return (
    <div
      ref={ref}
      data-revealed={visible ? 'true' : 'false'}
      data-variant={variant}
      className={`reveal ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
    >
      {children}
    </div>
  );
}
