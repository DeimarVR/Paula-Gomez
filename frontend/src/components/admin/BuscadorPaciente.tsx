'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, UserRound, X } from 'lucide-react';
import { api } from '@/lib/apiClient';

interface Resultado {
  id: string;
  fullName: string;
  phone: string;
  documentId: string | null;
  /** Lo usa el alta de cita para rellenar el contacto. */
  email?: string | null;
  /** Lo usa la ficha clínica para calcular la edad del paciente. */
  birthDate?: string | null;
}

interface Props {
  /** Paciente ya vinculado, si lo hay. */
  seleccionado: { id: string; fullName: string; documentId?: string | null } | null;
  onSeleccionar: (paciente: Resultado) => void;
  onQuitar: () => void;
}

/**
 * Busca un paciente de la base y lo vincula al documento.
 *
 * Vincular es OPCIONAL a propósito: al mostrador llega gente que compra un
 * producto sin ser paciente, y obligar a crearle historia clínica para poder
 * cobrarle sería absurdo. Cuando sí hay paciente, sus datos se copian a los
 * campos del cliente, pero quedan editables: lo que se imprime es lo que la
 * persona pidió que se imprimiera, no lo que dice la ficha.
 */
export function BuscadorPaciente({ seleccionado, onSeleccionar, onQuitar }: Props) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Se espera a que deje de escribir: sin esto sale una petición por tecla.
  useEffect(() => {
    const termino = texto.trim();
    if (termino.length < 2) {
      setResultados([]);
      return;
    }

    const control = new AbortController();
    const temporizador = setTimeout(async () => {
      setBuscando(true);
      try {
        const datos = await api.get<{ items: Resultado[] }>(
          `/api/patients?take=8&active=true&q=${encodeURIComponent(termino)}`,
          { signal: control.signal },
        );
        setResultados(datos.items);
        setAbierto(true);
      } catch {
        // Una búsqueda cancelada o fallida no es un error que mostrar: el
        // formulario sigue siendo usable escribiendo el nombre a mano.
      } finally {
        setBuscando(false);
      }
    }, 300);

    return () => {
      control.abort();
      clearTimeout(temporizador);
    };
  }, [texto]);

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    function fuera(evento: MouseEvent) {
      if (caja.current && !caja.current.contains(evento.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, []);

  if (seleccionado) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm">
        <UserRound className="h-4 w-4 shrink-0 text-brand-700" strokeWidth={1.8} aria-hidden />
        <span className="min-w-0 flex-1 truncate font-medium text-brand-800">
          {seleccionado.fullName}
          {seleccionado.documentId && (
            <span className="font-normal text-brand-700/70"> · C.C. {seleccionado.documentId}</span>
          )}
        </span>
        <button
          type="button"
          onClick={onQuitar}
          className="rounded-lg p-1 text-brand-700 transition-colors hover:bg-brand-100"
          aria-label="Desvincular paciente"
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div ref={caja} className="relative">
      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
        {buscando ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" aria-hidden />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.8} aria-hidden />
        )}
        <input
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          onFocus={() => resultados.length > 0 && setAbierto(true)}
          placeholder="Buscar paciente por nombre, cédula o teléfono…"
          className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </div>

      {abierto && resultados.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-line bg-white py-1 shadow-lift">
          {resultados.map((paciente) => (
            <li key={paciente.id}>
              <button
                type="button"
                onClick={() => {
                  onSeleccionar(paciente);
                  setTexto('');
                  setAbierto(false);
                }}
                className="flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-brand-50"
              >
                <span className="font-medium">{paciente.fullName}</span>
                <span className="text-xs text-muted">
                  {paciente.documentId ? `C.C. ${paciente.documentId} · ` : ''}
                  {paciente.phone}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {abierto && !buscando && texto.trim().length >= 2 && resultados.length === 0 && (
        <p className="absolute z-20 mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-xs text-muted shadow-lift">
          Sin coincidencias. Puedes escribir los datos del cliente a mano.
        </p>
      )}
    </div>
  );
}
