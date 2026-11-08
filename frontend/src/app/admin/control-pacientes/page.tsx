'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Loader2, Plus, Search } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { claveFecha, fechaLarga, telefonoLocal } from '@/lib/format';
import {
  TIPOS_ATENCION,
  TIPO_EN_ENLACE,
  TITULO_MODULO,
  type TipoAtencion,
} from '@/lib/controlEvolutivo';

/**
 * Los tres tipos que se pueden filtrar.
 *
 * «Facial» no es un tipo de atención de la ficha capilar: es otra ficha, en
 * otra tabla. Pero para quien mira esta pantalla son tres cosas del mismo
 * estante, y el filtro tenía dos opciones para tres botones de arriba.
 */
type TipoDeFicha = TipoAtencion | 'FACIAL';

const TIPOS_DE_FICHA: Array<{ id: TipoDeFicha; etiqueta: string }> = [
  ...TIPOS_ATENCION,
  { id: 'FACIAL', etiqueta: 'Faciales' },
];

interface FichaListada {
  id: string;
  procedureDate: string;
  patientName: string;
  patientDocument: string | null;
  patientPhone: string | null;
  careType: TipoDeFicha;
  createdAt: string;
  patient: { id: string; fullName: string } | null;
  _count: { entries: number };
}

export default function ControlEvolutivoPage() {
  const [items, setItems] = useState<FichaListada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState<TipoDeFicha | ''>('');

  /**
   * `signal` no es un adorno: es la mitad del arreglo del buscador.
   *
   * Escribir «Juan Moncayo» dispara una consulta por «Juan» antes de terminar
   * la palabra. Si esa respuesta —más larga, con todos los Juan del centro—
   * llegaba después de la de «Juan Moncayo», pisaba a la buena y en pantalla
   * quedaba una lista de gente que no se estaba buscando. Cancelar la anterior
   * antes de lanzar la siguiente hace que solo pueda ganar la última.
   */
  const cargar = useCallback(async (signal?: AbortSignal) => {
    setCargando(true);
    const parametros = new URLSearchParams();
    if (busqueda.trim()) parametros.set('q', busqueda.trim());
    if (tipo) parametros.set('careType', tipo);

    try {
      const datos = await api.get<{ items: FichaListada[] }>(
        `/api/clinical-records?${parametros.toString()}`,
        { signal },
      );
      setItems(datos.items);
      setError(null);
    } catch (caught) {
      // Abortar no es fallar: es que la persona siguió escribiendo.
      if (signal?.aborted || (caught as Error)?.name === 'AbortError') return;
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar las fichas');
    } finally {
      if (!signal?.aborted) setCargando(false);
    }
  }, [busqueda, tipo]);

  useEffect(() => {
    const control = new AbortController();
    const temporizador = setTimeout(() => void cargar(control.signal), 300);
    return () => {
      clearTimeout(temporizador);
      control.abort();
    };
  }, [cargar]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">{TITULO_MODULO}</h1>
          <p className="mt-2 text-muted">
            Fichas clínicas capilares y faciales. Las capilares conservan el formato de la hoja
            de papel.
          </p>
        </div>
        {/*
          Un botón por tipo de ficha, sin menús desplegables: son documentos
          distintos y esconder la elección detrás de un clic extra hace que se
          empiece la ficha equivocada.

          Capilar y trasplante son la MISMA hoja —los mismos campos, las mismas
          funciones— y se distinguen por el tipo de atención, que ya existía
          dentro del formulario. Lo que faltaba era entrar con el tipo ya
          puesto: marcarlo a mano es justo lo que se olvida con el paciente
          delante, y una ficha de trasplante guardada como capilar no aparece
          donde la van a buscar.
        */}
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/control-pacientes/nueva" className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Nueva ficha capilar
          </Link>
          <Link
            href={`/admin/control-pacientes/nueva?tipo=${TIPO_EN_ENLACE.TRASPLANTE}`}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Nuevo trasplante capilar
          </Link>
          <Link href="/admin/control-pacientes/facial/nueva" className="btn-outline">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Nueva ficha facial
          </Link>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 py-2">
          <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.8} aria-hidden />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Nombre, documento o teléfono…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            aria-label="Buscar fichas"
          />
        </div>

        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoDeFicha | '')}
          aria-label="Filtrar por tipo de paciente"
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none"
        >
          <option value="">Todos los tipos</option>
          {TIPOS_DE_FICHA.map((opcion) => (
            <option key={opcion.id} value={opcion.id}>{opcion.etiqueta}</option>
          ))}
        </select>
      </div>

      {error && <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>}

      {cargando && items.length === 0 ? (
        <div className="flex items-center gap-3 py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          No hay fichas con esos filtros.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="px-5 py-3 font-semibold">Paciente</th>
                <th scope="col" className="px-5 py-3 font-semibold">Documento</th>
                <th scope="col" className="px-5 py-3 font-semibold">Procedimiento</th>
                <th scope="col" className="px-5 py-3 font-semibold">Tipo</th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">Sesiones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((ficha) => (
                <tr key={ficha.id} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-3">
                    <Link
                      href={
                        ficha.careType === 'FACIAL'
                          ? `/admin/control-pacientes/facial/${ficha.id}`
                          : `/admin/control-pacientes/${ficha.id}`
                      }
                      className="flex items-center gap-2 font-medium text-brand-800 hover:underline"
                    >
                      <ClipboardList className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.8} aria-hidden />
                      {ficha.patientName}
                    </Link>
                    {ficha.patientPhone && (
                      <span className="ml-6 text-xs text-muted">
                        {telefonoLocal(ficha.patientPhone)}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 tabular-nums text-muted">{ficha.patientDocument ?? '—'}</td>
                  <td className="px-5 py-3 text-muted">
                    {fechaLarga(claveFecha(ficha.procedureDate))}
                    {/*
                      La lista va por fecha de CREACIÓN, no por la del
                      procedimiento. Sin decirlo, el orden parece roto: se ven
                      fechas saltadas en la única columna de fecha que hay. Solo
                      se muestra cuando son días distintos, que es cuando la
                      diferencia explica algo.
                    */}
                    {claveFecha(ficha.createdAt) !== claveFecha(ficha.procedureDate) && (
                      <span className="block text-xs text-muted/70">
                        Registrada el {fechaLarga(claveFecha(ficha.createdAt))}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800">
                      {TIPOS_DE_FICHA.find((t) => t.id === ficha.careType)?.etiqueta}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">{ficha._count.entries}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
