'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { claveFecha } from '@/lib/format';
import { FichaFacialForm } from '@/components/admin/FichaFacialForm';
import type { FichaFacial } from '@/lib/fichaFacial';

/** Lo que devuelve la API, antes de pasarlo a lo que el formulario maneja. */
interface RespuestaFicha {
  id: string;
  patientId: string;
  openedAt: string;
  patientName: string;
  patientDocument: string | null;
  patientAge: number | null;
  patientPhone: string | null;
  skinType: string | null;
  skinCondition: string | null;
  concerns: string[];
  allergies: string | null;
  contraindications: string | null;
  notes: string | null;
  entries: Array<{
    id: string;
    sessionDate: string;
    sessionLabel: string | null;
    serviceId: string | null;
    zones: string[];
    productId: string | null;
    productName: string | null;
    lotNumber: string | null;
    quantity: number | null;
    quantityUnit: string | null;
    technique: string | null;
    findings: string | null;
    homeCare: string | null;
    nextControl: string | null;
    nextControlTime: string | null;
    nextControlServiceId: string | null;
    professionalSignature: string | null;
    patientSignature: string | null;
  }>;
}

/**
 * Pasa la respuesta de la API a lo que el formulario maneja: todo cadena, y las
 * fechas en «AAAA-MM-DD», que es lo que entiende un `input[type=date]`.
 */
function aFormulario(datos: RespuestaFicha): FichaFacial {
  return {
    id: datos.id,
    patientId: datos.patientId,
    openedAt: claveFecha(datos.openedAt),
    patientName: datos.patientName,
    patientDocument: datos.patientDocument ?? '',
    patientAge: datos.patientAge ? String(datos.patientAge) : '',
    patientPhone: datos.patientPhone ?? '',
    skinType: datos.skinType ?? '',
    skinCondition: datos.skinCondition ?? '',
    concerns: datos.concerns,
    allergies: datos.allergies ?? '',
    contraindications: datos.contraindications ?? '',
    notes: datos.notes ?? '',
    entries: datos.entries.map((linea) => ({
      id: linea.id,
      sessionDate: claveFecha(linea.sessionDate),
      sessionLabel: linea.sessionLabel ?? '',
      serviceId: linea.serviceId ?? '',
      zones: linea.zones,
      productId: linea.productId ?? '',
      productName: linea.productName ?? '',
      lotNumber: linea.lotNumber ?? '',
      quantity: linea.quantity !== null ? String(linea.quantity) : '',
      quantityUnit: linea.quantityUnit ?? 'U',
      technique: linea.technique ?? '',
      findings: linea.findings ?? '',
      homeCare: linea.homeCare ?? '',
      nextControl: linea.nextControl ? claveFecha(linea.nextControl) : '',
      nextControlTime: linea.nextControlTime ?? '',
      nextControlServiceId: linea.nextControlServiceId ?? '',
      professionalSignature: linea.professionalSignature,
      patientSignature: linea.patientSignature,
    })),
  };
}

export default function EditarFichaFacialPage({ params }: { params: { id: string } }) {
  const [ficha, setFicha] = useState<FichaFacial | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .get<RespuestaFicha>(`/api/facial/${params.id}`)
      .then((datos) => setFicha(aFormulario(datos)))
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : 'No pudimos cargar la ficha'),
      );
  }, [params.id]);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/admin/control-pacientes" className="btn-ghost mb-6 text-sm">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden />
        Volver
      </Link>

      <h1 className="text-3xl">Ficha facial</h1>

      {error && (
        <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
      )}

      {!ficha && !error ? (
        <div className="flex items-center gap-3 py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : ficha ? (
        <div className="mt-8">
          <FichaFacialForm inicial={ficha} />
        </div>
      ) : null}
    </div>
  );
}
