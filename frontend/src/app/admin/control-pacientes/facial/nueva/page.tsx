import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { FichaFacialForm } from '@/components/admin/FichaFacialForm';

export default function NuevaFichaFacialPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/control-pacientes" className="btn-ghost mb-6 text-sm">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        Volver
      </Link>

      <h1 className="text-3xl">Nueva ficha facial</h1>
      <p className="mt-2 max-w-2xl text-muted">
        Para tratamientos faciales y estéticos. La ficha capilar es otra, con sus propios campos.
      </p>

      <div className="mt-8">
        <FichaFacialForm />
      </div>
    </div>
  );
}
