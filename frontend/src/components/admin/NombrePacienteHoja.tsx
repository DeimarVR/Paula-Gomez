'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { api } from '@/lib/apiClient';

/**
 * Un campo de nombre que además busca pacientes ya registrados.
 *
 * Nació para la hoja clínica —de ahí el nombre del archivo— y hoy lo usan
 * también la ficha facial: en todas, el patrón es el mismo.
 *
 * Antes la búsqueda vivía en una tarjeta aparte, encima de la hoja: había que
 * buscar al paciente en un sitio para que se rellenara otro. Dos pasos y dos
 * cajas para una sola cosa. Ahora se escribe el nombre donde va el nombre y
 * las fichas que coinciden salen debajo; elegir una trae documento, teléfono
 * y edad.
 *
 * Sigue pudiendo escribirse un nombre que no está en la base: la hoja se
 * rellena igual. Lo que no se puede es GUARDAR sin haber vinculado una ficha,
 * y de eso se encarga el formulario, no este campo.
 */

export interface PacienteEncontrado {
  id: string;
  fullName: string;
  phone: string;
  documentId: string | null;
  birthDate?: string | null;
}

interface Props {
  valor: string;
  onEscribir: (valor: string) => void;
  onElegir: (paciente: PacienteEncontrado) => void;
  /** Hay una ficha detrás de este nombre. */
  vinculado: boolean;
  /**
   * Las clases las pone quien lo usa, porque las dos disposiciones de la ficha
   * no se parecen en nada: en la hoja es una línea de 10 px sobre el papel y en
   * la columna del celular es una caja con borde y letra de 16 px —por debajo
   * de eso Safari hace zoom al enfocar y descoloca la pantalla—.
   */
  claseContenedor: string;
  claseInput: string;
  /** El texto de dentro cambia según dónde se use; la mecánica no. */
  placeholder?: string;
  mensajeVacio?: string;
  etiqueta?: string;
}

export function NombrePacienteHoja({
  valor,
  onEscribir,
  onElegir,
  vinculado,
  claseContenedor,
  claseInput,
  placeholder = 'Escribe para buscar en las historias…',
  mensajeVacio = 'Ninguna historia coincide. Créala primero en Pacientes.',
  etiqueta = 'Nombre del paciente',
}: Props) {
  const [texto, setTexto] = useState('');
  const [resultados, setResultados] = useState<PacienteEncontrado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Se busca lo que se está escribiendo, no el valor de la hoja: al elegir un
  // paciente la hoja cambia sola y no queremos que eso dispare otra búsqueda.
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
        const datos = await api.get<{ items: PacienteEncontrado[] }>(
          `/api/patients?take=8&active=true&q=${encodeURIComponent(termino)}`,
          { signal: control.signal },
        );
        setResultados(datos.items);
        setAbierto(true);
      } catch {
        // Que falle la sugerencia no puede impedir escribir el nombre a mano.
      } finally {
        setBuscando(false);
      }
    }, 300);

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

  return (
    <span ref={caja} className={`relative ${claseContenedor}`}>
      <span className="flex items-center gap-1">
        <input
          value={valor}
          onChange={(evento) => {
            onEscribir(evento.target.value);
            setTexto(evento.target.value);
          }}
          onFocus={() => resultados.length > 0 && setAbierto(true)}
          placeholder={placeholder}
          aria-label={etiqueta}
          className={claseInput}
        />
        {buscando ? (
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-brand-700" aria-hidden />
        ) : vinculado ? (
          <Check
            className="h-3 w-3 shrink-0 text-brand-700"
            strokeWidth={3}
            aria-label="Vinculado a una historia"
          />
        ) : null}
      </span>

      {abierto && resultados.length > 0 && (
        <ul className="absolute left-0 top-full z-30 mt-1 max-h-56 w-full min-w-[15rem] overflow-auto rounded-xl border border-line bg-white py-1 text-left shadow-lift">
          {resultados.map((paciente) => (
            <li key={paciente.id}>
              <button
                type="button"
                onClick={() => {
                  onElegir(paciente);
                  setTexto('');
                  setResultados([]);
                  setAbierto(false);
                }}
                className="flex w-full flex-col items-start px-3 py-1.5 text-left transition-colors hover:bg-brand-50"
              >
                <span className="text-[11px] font-medium leading-tight">{paciente.fullName}</span>
                <span className="text-[10px] leading-tight text-muted">
                  {paciente.documentId ? `C.C. ${paciente.documentId} · ` : ''}
                  {paciente.phone}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {abierto && !buscando && texto.trim().length >= 2 && resultados.length === 0 && (
        <p className="absolute left-0 top-full z-30 mt-1 w-full min-w-[15rem] rounded-xl border border-line bg-white px-3 py-2 text-left text-[10px] text-muted shadow-lift">
          {mensajeVacio}
        </p>
      )}
    </span>
  );
}
