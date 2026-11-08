'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Pencil, Printer, Trash2 } from 'lucide-react';
import { FichaHoja } from '@/components/admin/FichaHoja';
import { api } from '@/lib/apiClient';
import type { Ficha } from '@/lib/controlEvolutivo';
import type { Service } from '@/lib/types';

export default function DetalleFichaPage({ params }: { params: { id: string } }) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [borrando, setBorrando] = useState(false);
  // Para poder mostrar el nombre del tratamiento del próximo control.
  const [servicios, setServicios] = useState<Service[]>([]);

  const cargar = useCallback(async () => {
    try {
      setFicha(await api.get<Ficha>(`/api/clinical-records/${params.id}`));
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar la ficha');
    } finally {
      setCargando(false);
    }
  }, [params.id]);

  useEffect(() => {
    void cargar();
    api
      .get<{ items: Service[] }>('/api/treatments')
      .then((datos) => setServicios(datos.items))
      .catch(() => {
        // Sin catálogo la ficha se ve igual; solo no sale el nombre del
        // tratamiento del próximo control.
      });
  }, [cargar]);

  async function eliminar() {
    const seguro = window.confirm(
      'Eliminar una ficha clínica borra la historia de esas sesiones y no se puede deshacer. ¿Continuar?',
    );
    if (!seguro) return;

    setBorrando(true);
    try {
      await api.delete(`/api/clinical-records/${params.id}`);
      window.location.href = '/admin/control-pacientes';
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos eliminar la ficha');
      setBorrando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-3 py-20 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Cargando…
      </div>
    );
  }

  if (!ficha) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">
          {error ?? 'Ficha no encontrada'}
        </p>
        <Link href="/admin/control-pacientes" className="mt-6 inline-block text-sm text-brand-800 hover:underline">
          Volver a control de pacientes
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="no-imprimir">
        <Link
          href="/admin/control-pacientes"
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-brand-800"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          Volver a control de pacientes
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl">{ficha.patientName}</h1>
            <p className="mt-2 text-muted">
              {ficha.entries.length} {ficha.entries.length === 1 ? 'sesión registrada' : 'sesiones registradas'}
              {ficha.createdBy ? ` · Elaborada por ${ficha.createdBy.fullName}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => window.print()} className="btn-primary">
              <Printer className="h-4 w-4" strokeWidth={2} aria-hidden />
              Imprimir
            </button>

            <Link
              href={`/admin/control-pacientes/${ficha.id}/editar`}
              className="flex items-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium transition-colors hover:bg-cream"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              Editar
            </Link>

            <button
              type="button"
              onClick={eliminar}
              disabled={borrando}
              className="flex items-center gap-2 rounded-xl border border-bad/40 px-4 py-2.5 text-sm font-medium text-bad transition-colors hover:bg-bad-bg disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              Eliminar
            </button>
          </div>
        </div>

        {error && <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>}

        {ficha.patient && (
          <p className="mt-6 text-sm text-muted">
            Historia de{' '}
            <Link
              href={`/admin/pacientes/${ficha.patient.id}`}
              className="font-medium text-brand-800 hover:underline"
            >
              {ficha.patient.fullName}
            </Link>
          </p>
        )}

        <p className="mt-6 text-xs text-muted">
          Vista previa de impresión (sale en horizontal):
        </p>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white p-4 shadow-soft print:mt-0 print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <FichaHoja datos={ficha} servicios={servicios} />
      </div>
    </div>
  );
}
