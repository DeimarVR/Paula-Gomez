'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { FichaForm } from '@/components/admin/FichaForm';
import { api } from '@/lib/apiClient';
import type { Ficha } from '@/lib/controlEvolutivo';

export default function EditarFichaPage({ params }: { params: { id: string } }) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Ficha>(`/api/clinical-records/${params.id}`)
      .then(setFicha)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : 'No pudimos cargar la ficha'),
      );
  }, [params.id]);

  if (error) return <p className="rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>;

  if (!ficha) {
    return (
      <div className="flex items-center gap-3 py-20 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Cargando…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={`/admin/control-pacientes/${ficha.id}`}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-brand-800"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        Volver a la ficha
      </Link>

      <h1 className="text-3xl">Editar ficha</h1>
      <p className="mb-8 mt-2 text-muted">{ficha.patientName}</p>

      <FichaForm ficha={ficha} />
    </div>
  );
}
