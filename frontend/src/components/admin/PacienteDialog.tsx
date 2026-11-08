'use client';

import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { ApiError, api } from '@/lib/apiClient';
import { edadCumplida } from '@/lib/controlEvolutivo';

/**
 * Alta y edición de un paciente, en el mismo sitio.
 *
 * Antes solo existía el alta, incrustada en la lista de pacientes: si alguien
 * cambiaba de celular o se había escrito mal la cédula, no había forma de
 * corregirlo desde el panel aunque la API llevara meses aceptando el `PUT`.
 *
 * Recibe un id y no el paciente entero a propósito. Quien lo abre casi nunca
 * tiene todos los campos a mano —la lista no trae antecedentes ni la
 * autorización de fotos—, y prellenar el formulario con lo poco que se tenga
 * sería peor que no prellenarlo: al guardar se pisarían los campos que no se
 * ven. Con el id, el diálogo pide la ficha completa y edita sobre ella.
 */

interface Props {
  /** Sin id, es un alta. */
  pacienteId?: string;
  onCerrar: () => void;
  onGuardado: (paciente: PacienteGuardado) => void;
}

export interface PacienteGuardado {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  documentId: string | null;
}

interface Formulario {
  fullName: string;
  phone: string;
  email: string;
  documentId: string;
  /** AAAA-MM-DD. De aquí sale la edad de las fichas. */
  birthDate: string;
  city: string;
  medicalNotes: string;
  photoConsent: boolean;
}

const VACIO: Formulario = {
  fullName: '',
  phone: '',
  email: '',
  documentId: '',
  birthDate: '',
  city: '',
  medicalNotes: '',
  photoConsent: false,
};

export function PacienteDialog({ pacienteId, onCerrar, onGuardado }: Props) {
  const edicion = Boolean(pacienteId);

  const [form, setForm] = useState<Formulario>(VACIO);
  const [cargando, setCargando] = useState(edicion);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    if (!pacienteId) return;

    void (async () => {
      try {
        const paciente = await api.get<{
          fullName: string;
          phone: string;
          email: string | null;
          documentId: string | null;
          birthDate: string | null;
          city: string | null;
          medicalNotes: string | null;
          photoConsent: boolean;
        }>(`/api/patients/${pacienteId}`);

        setForm({
          fullName: paciente.fullName,
          phone: paciente.phone,
          email: paciente.email ?? '',
          documentId: paciente.documentId ?? '',
          // Llega como instante ISO; el input de fecha quiere AAAA-MM-DD.
          birthDate: paciente.birthDate ? paciente.birthDate.slice(0, 10) : '',
          city: paciente.city ?? '',
          medicalNotes: paciente.medicalNotes ?? '',
          photoConsent: paciente.photoConsent,
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught : new Error('No pudimos cargar la ficha'));
      } finally {
        setCargando(false);
      }
    })();
  }, [pacienteId]);

  /**
   * Se guarda la FECHA DE NACIMIENTO y no la edad, aunque la ficha pida edad.
   * Una edad escrita a mano envejece mal: dentro de dos años seguiría diciendo
   * lo mismo. De la fecha se saca la edad de cualquier día.
   */
  const edad = edadCumplida(form.birthDate || null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);

    const cuerpo = {
      fullName: form.fullName,
      phone: form.phone,
      email: form.email || null,
      documentId: form.documentId || null,
      // El esquema del servidor espera un instante completo, no solo el día.
      birthDate: form.birthDate ? `${form.birthDate}T12:00:00.000Z` : null,
      city: form.city || null,
      medicalNotes: form.medicalNotes || null,
      photoConsent: form.photoConsent,
    };

    try {
      const guardado = pacienteId
        ? await api.put<PacienteGuardado>(`/api/patients/${pacienteId}`, cuerpo)
        : await api.post<PacienteGuardado>('/api/patients', cuerpo);

      onGuardado(guardado);
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error('Error inesperado'));
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-5 backdrop-blur-sm">
      <form
        onSubmit={enviar}
        className="max-h-[90vh] w-full min-w-0 max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">
              {edicion ? 'Editar paciente' : 'Nuevo paciente'}
            </h2>
            {edicion && (
              <p className="mt-1 text-sm text-muted">
                Los cambios valen para las citas y documentos nuevos; los ya emitidos no se tocan.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-brand-50"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {cargando ? (
          <div className="flex items-center gap-3 py-16 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            Cargando la ficha…
          </div>
        ) : (
          <>
            <div className="mt-7 space-y-5">
              <div>
                <label htmlFor="pac-fullName" className="field-label">
                  Nombre completo *
                </label>
                <input
                  id="pac-fullName"
                  required
                  value={form.fullName}
                  onChange={(evento) => setForm({ ...form, fullName: evento.target.value })}
                  className="field"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="pac-phone" className="field-label">
                    Celular *
                  </label>
                  <input
                    id="pac-phone"
                    required
                    inputMode="tel"
                    value={form.phone}
                    onChange={(evento) => setForm({ ...form, phone: evento.target.value })}
                    className="field"
                    placeholder="300 111 2233"
                  />
                </div>
                <div>
                  <label htmlFor="pac-documentId" className="field-label">
                    Cédula
                  </label>
                  <input
                    id="pac-documentId"
                    inputMode="numeric"
                    value={form.documentId}
                    onChange={(evento) => setForm({ ...form, documentId: evento.target.value })}
                    className="field"
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    Es lo que distingue a dos pacientes con el mismo nombre.
                  </p>
                </div>
                <div>
                  <label htmlFor="pac-email" className="field-label">
                    Correo
                  </label>
                  <input
                    id="pac-email"
                    type="email"
                    value={form.email}
                    onChange={(evento) => setForm({ ...form, email: evento.target.value })}
                    className="field"
                  />
                </div>
                <div>
                  <label htmlFor="pac-birth" className="field-label">
                    Fecha de nacimiento
                  </label>
                  <input
                    id="pac-birth"
                    type="date"
                    value={form.birthDate}
                    onChange={(evento) => setForm({ ...form, birthDate: evento.target.value })}
                    className="field"
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    {edad === null
                      ? 'Con esto las fichas calculan la edad solas.'
                      : `Hoy tiene ${edad} años.`}
                  </p>
                </div>

                <div>
                  <label htmlFor="pac-city" className="field-label">
                    Ciudad
                  </label>
                  <input
                    id="pac-city"
                    value={form.city}
                    onChange={(evento) => setForm({ ...form, city: evento.target.value })}
                    className="field"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="pac-medicalNotes" className="field-label">
                  Antecedentes y observaciones
                </label>
                <textarea
                  id="pac-medicalNotes"
                  rows={3}
                  value={form.medicalNotes}
                  onChange={(evento) => setForm({ ...form, medicalNotes: evento.target.value })}
                  className="field resize-none"
                  placeholder="Alergias, medicación actual, antecedentes familiares…"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-50 p-4 text-sm">
                <input
                  type="checkbox"
                  checked={form.photoConsent}
                  onChange={(evento) => setForm({ ...form, photoConsent: evento.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-brand-300 text-brand-700 focus:ring-brand-500"
                />
                <span className="text-brand-900">
                  Firmó la autorización para publicar sus fotos de antes y después.
                </span>
              </label>
            </div>

            {error && (
              <p className="mt-5 rounded-2xl bg-bad-bg px-4 py-3 text-sm text-bad">
                {error.message}
              </p>
            )}

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onCerrar} className="btn-outline sm:flex-1">
                Cancelar
              </button>
              <button type="submit" disabled={guardando} className="btn-primary sm:flex-1">
                {guardando ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : edicion ? (
                  'Guardar cambios'
                ) : (
                  'Crear paciente'
                )}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
