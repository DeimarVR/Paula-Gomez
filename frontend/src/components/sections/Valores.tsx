import { Reveal } from '@/components/ui/Reveal';
import { VALORES } from '@/lib/config';

/**
 * La franja de cifras debajo de la portada.
 *
 * Cuatro cosas que el paciente puede esperar, dichas con un número. Son
 * compromisos del funcionamiento —la duración de la consulta, el recordatorio
 * la víspera—, no estadísticas de resultados: esas no se publican sin poder
 * sostenerlas.
 */
/*
 * Las rayas entre cifras cambian con el ancho: una columna en el celular, dos
 * en tableta y cuatro en escritorio. Escritas a mano porque Tailwind necesita
 * el nombre completo de cada clase.
 */
const BORDES = [
  'sm:pr-5 lg:pr-7',
  'border-t sm:border-l sm:border-t-0 sm:pl-5 lg:px-7',
  'border-t lg:border-l lg:border-t-0 sm:pr-5 lg:px-7',
  'border-t sm:border-l sm:pl-5 lg:border-t-0 lg:px-7',
];

export function Valores() {
  return (
    <section aria-label="Lo que puede esperar" className="border-y border-line bg-surface">
      <div className="shell">
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4">
          {VALORES.map((valor, indice) => (
            <li key={valor.unidad} className={`border-line py-7 lg:py-10 ${BORDES[indice] ?? ''}`}>
              <Reveal delay={indice * 90}>
                <div className="font-display text-[clamp(2.5rem,3.8vw,3.4rem)] font-normal leading-none tracking-[-0.03em] text-ink">
                  {valor.cifra}
                  <small className="ml-1.5 text-[0.42em] italic tracking-normal text-accent-700">{valor.unidad}</small>
                </div>
                <p className="mt-3 max-w-[250px] text-[15px] leading-normal text-muted">{valor.texto}</p>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
