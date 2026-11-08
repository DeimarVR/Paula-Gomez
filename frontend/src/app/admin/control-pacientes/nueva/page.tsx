'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { FichaForm } from '@/components/admin/FichaForm';
import { TIPOS_ATENCION, tipoDesdeEnlace } from '@/lib/controlEvolutivo';

/**
 * Ficha nueva, capilar o de trasplante.
 *
 * Es la MISMA hoja para las dos: mismos campos, mismas funciones, mismo
 * guardado. Lo único que cambia es con qué tipo de atención entra marcada, que
 * llega en la dirección (`?tipo=trasplante`). Sin parámetro se abre la capilar,
 * como siempre.
 *
 * No se duplicó el formulario a propósito. Dos copias de una hoja clínica es
 * exactamente el problema que arreglamos esta semana en otra parte del sistema:
 * el día que se corrige un campo, se corrige en una sola y nadie se entera de
 * que la otra quedó distinta.
 */
function Formulario() {
  const tipo = tipoDesdeEnlace(useSearchParams().get('tipo'));
  const etiqueta = TIPOS_ATENCION.find((t) => t.id === tipo)?.etiqueta ?? '';
  const esTrasplante = tipo === 'TRASPLANTE';

  return (
    <>
      <h1 className="text-3xl">{esTrasplante ? 'Nuevo trasplante capilar' : 'Nueva ficha'}</h1>
      <p className="mb-8 mt-2 text-muted">
        {esTrasplante
          ? 'La ficha entra marcada como trasplante; abajo se anotan los folículos y la garantía. '
          : ''}
        La fecha viene con la de hoy; cámbiala si registras un procedimiento de otro día.
      </p>

      {/*
        El tipo se anuncia aunque ya venga puesto: quien abre la hoja tiene que
        poder ver de un vistazo cuál está llenando, y no descubrirlo al guardar.
      */}
      {esTrasplante && (
        <p className="mb-6 rounded-2xl bg-brand-50 px-5 py-3 text-sm text-brand-900">
          Tipo de atención: <strong>{etiqueta}</strong>. Se puede cambiar dentro de la hoja.
        </p>
      )}

      <FichaForm tipoInicial={tipo} />
    </>
  );
}

export default function NuevaFichaPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href="/admin/control-pacientes"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-brand-800"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        Volver a control de pacientes
      </Link>

      {/*
        `useSearchParams` obliga a envolver en Suspense: sin esto, Next saca de
        la compilación toda la página como dinámica y falla el build.
      */}
      <Suspense fallback={<p className="py-16 text-sm text-muted">Cargando…</p>}>
        <Formulario />
      </Suspense>
    </div>
  );
}
