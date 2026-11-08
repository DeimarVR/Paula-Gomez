'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { formatPhone, iniciales } from '@/lib/format';

interface Resultado {
  id: string;
  fullName: string;
  phone: string;
  documentId: string | null;
}

/**
 * La búsqueda de la barra superior: escribir un nombre, una cédula o un
 * celular y saltar al expediente.
 *
 * Es lo que más se hace en el panel —«ábreme a la señora que acaba de
 * llegar»— y antes obligaba a ir a Pacientes, buscar y hacer clic. Aquí está
 * en todas las pantallas.
 *
 * Teclado completo: flechas para moverse, Enter para abrir, Escape para
 * cerrar. Si se pulsa Enter sin elegir, se abre la lista de pacientes ya
 * filtrada con lo escrito.
 */
export function BuscadorRapido() {
  const router = useRouter();
  const id = useId();
  const caja = useRef<HTMLDivElement>(null);
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);

  // Se espera a que deje de escribir: sin esto sale una petición por tecla.
  useEffect(() => {
    const termino = texto.trim();
    if (termino.length < 2) {
      setResultados([]);
      setAbierto(false);
      return undefined;
    }

    const control = new AbortController();
    const temporizador = setTimeout(async () => {
      setBuscando(true);
      try {
        const datos = await api.get<{ items: Resultado[] }>(
          `/api/patients?take=6&q=${encodeURIComponent(termino)}`,
          { signal: control.signal },
        );
        setResultados(datos.items);
        setActivo(-1);
        setAbierto(true);
      } catch {
        // Cancelada o fallida: la barra sigue sirviendo con Enter.
      } finally {
        setBuscando(false);
      }
    }, 250);

    return () => {
      control.abort();
      clearTimeout(temporizador);
    };
  }, [texto]);

  useEffect(() => {
    function fuera(evento: MouseEvent) {
      if (caja.current && !caja.current.contains(evento.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  function abrir(paciente: Resultado) {
    setAbierto(false);
    setTexto('');
    router.push(`/admin/pacientes/${paciente.id}`);
  }

  function alTeclear(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'ArrowDown' && resultados.length) {
      evento.preventDefault();
      setAbierto(true);
      setActivo((i) => (i + 1) % resultados.length);
    } else if (evento.key === 'ArrowUp' && resultados.length) {
      evento.preventDefault();
      setActivo((i) => (i <= 0 ? resultados.length - 1 : i - 1));
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      const elegido = resultados[activo];
      if (elegido) abrir(elegido);
      else if (texto.trim()) {
        setAbierto(false);
        router.push(`/admin/pacientes?q=${encodeURIComponent(texto.trim())}`);
      }
    } else if (evento.key === 'Escape') {
      setAbierto(false);
    }
  }

  return (
    <div ref={caja} className="relative w-full max-w-[420px] flex-1">
      <label htmlFor={`${id}-q`} className="sr-only">
        Buscar paciente
      </label>
      {buscando ? (
        <Loader2
          className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 animate-spin text-subtle"
          aria-hidden
        />
      ) : (
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-subtle"
          strokeWidth={1.8}
          aria-hidden
        />
      )}
      <input
        id={`${id}-q`}
        type="search"
        role="combobox"
        aria-expanded={abierto}
        aria-controls={`${id}-lista`}
        aria-activedescendant={activo >= 0 ? `${id}-op-${activo}` : undefined}
        autoComplete="off"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={alTeclear}
        onFocus={() => resultados.length && setAbierto(true)}
        placeholder="Buscar paciente, documento o celular"
        className="h-[42px] w-full rounded-lg border border-line bg-surface pl-10 pr-3 text-[14.5px] text-ink placeholder:text-subtle focus:border-brand-600 focus:outline-none focus:ring-[3px] focus:ring-brand-600/20"
      />

      {abierto && (
        <ul
          id={`${id}-lista`}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lift"
        >
          {resultados.length === 0 ? (
            <li className="px-4 py-3 text-sm text-muted">Nadie con ese nombre, cédula o celular.</li>
          ) : (
            resultados.map((paciente, indice) => (
              <li
                key={paciente.id}
                id={`${id}-op-${indice}`}
                role="option"
                aria-selected={indice === activo}
                onMouseDown={(e) => {
                  e.preventDefault();
                  abrir(paciente);
                }}
                onMouseEnter={() => setActivo(indice)}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 ${
                  indice === activo ? 'bg-brand-50' : ''
                }`}
              >
                <span className="avatar h-8 w-8 text-xs" aria-hidden>
                  {iniciales(paciente.fullName)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {paciente.fullName}
                  </span>
                  <span className="block truncate text-xs text-subtle">
                    {formatPhone(paciente.phone)}
                    {paciente.documentId ? ` · CC ${paciente.documentId}` : ''}
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

