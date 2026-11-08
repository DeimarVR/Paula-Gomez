'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Loader2, Plus } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { claveFecha, fechaLarga } from '@/lib/format';
import { TIPOS_ATENCION, type TipoAtencion } from '@/lib/controlEvolutivo';

/**
 * Las fichas de control de un paciente, dentro de su historia.
 *
 * Ocupa el sitio donde estaban los planes de tratamiento. La ficha es ahora el
 * registro clínico: tener las dos cosas significaba escribir cada visita dos
 * veces, que es justo lo que se quiso quitar.
 */

interface FichaResumen {
  id: string;
  procedureDate: string;
  careType: TipoAtencion;
  _count: { entries: number };
}

export function FichasDelPaciente({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<FichaResumen[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api
      .get<{ items: FichaResumen[] }>(`/api/clinical-records?patientId=${patientId}`)
      .then((datos) => setItems(datos.items))
      .catch(() => {
        // Si falla, la sección se comporta como si no hubiera fichas: el botón
        // para crear una sigue ahí, que es lo que la persona necesita.
      })
      .finally(() => setCargando(false));
  }, [patientId]);

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-xl">Control de pacientes</h2>
        <Link href="/admin/control-pacientes/nueva" className="btn-primary text-sm">
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Nueva ficha
        </Link>
      </div>

      {cargando ? (
        <div className="flex items-center gap-3 py-10 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Cargando fichas…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-line bg-surface px-6 py-14 text-center">
          <p className="font-display text-lg">Sin fichas de control</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Aquí se registra el tratamiento sesión por sesión, con las zonas afectadas, la
            medicación y las firmas. Es lo que se imprime.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {items.map((ficha) => (
            <Link
              key={ficha.id}
              href={`/admin/control-pacientes/${ficha.id}`}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:bg-brand-50"
            >
              <ClipboardList className="h-5 w-5 shrink-0 text-brand-700" strokeWidth={1.8} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {fechaLarga(claveFecha(ficha.procedureDate))}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {TIPOS_ATENCION.find((t) => t.id === ficha.careType)?.etiqueta} ·{' '}
                  {ficha._count.entries}{' '}
                  {ficha._count.entries === 1 ? 'sesión registrada' : 'sesiones registradas'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
