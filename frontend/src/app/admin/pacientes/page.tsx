'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { BorrarPacienteDialog } from '@/components/admin/BorrarPacienteDialog';
import { PacienteDialog } from '@/components/admin/PacienteDialog';
import { formatDateShort, formatPhone } from '@/lib/format';
import { estaIncompleto, textoDeLoQueFalta } from '@/lib/pacienteIncompleto';
import type { PatientListItem } from '@/lib/types';

export default function PacientesPage() {
  const [items, setItems] = useState<PatientListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  // La búsqueda de la barra superior llega aquí con ?q= al pulsar Enter.
  const [query, setQuery] = useState(() =>
    typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('q') ?? ''),
  );
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  /** Id del paciente que se está editando, si hay alguno. */
  const [editando, setEditando] = useState<string | null>(null);
  /** Deja a la vista solo los que les falta cédula o teléfono. */
  const [soloIncompletos, setSoloIncompletos] = useState(false);
  /** El paciente que se está a punto de borrar, si hay alguno. */
  const [borrando, setBorrando] = useState<PatientListItem | null>(null);
  /** Lo que acaba de pasar, para confirmarlo sin que haya que adivinarlo. */
  const [aviso, setAviso] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ take: '60' });
      if (query) params.set('q', query);

      const data = await api.get<{ items: PatientListItem[]; total: number }>(
        `/api/patients?${params.toString()}`,
      );
      setItems(data.items);
      setTotal(data.total);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar los pacientes');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), query ? 400 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  /*
   * El botón de borrar lo ve cualquiera con sesión.
   *
   * Quien se topa con el duplicado es justamente quien atiende el mostrador,
   * que es quien lo creó sin querer. Lo que protege aquí no es el rol: es que
   * solo se borra un paciente COMPLETAMENTE vacío, y eso lo comprueba el
   * servidor con la fila bloqueada, no la pantalla.
   */

  /**
   * Se calcula sobre lo que hay en pantalla, no en el servidor: la marca sale
   * de los mismos datos que ya se están mostrando, así que no hace falta ni una
   * consulta más ni una columna nueva.
   */
  const incompletos = items.filter(estaIncompleto).length;
  const visibles = soloIncompletos ? items.filter(estaIncompleto) : items;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Pacientes</h1>
          <p className="mt-2 text-muted">{total} registrados en total.</p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="btn-primary">
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Nuevo paciente
        </button>
      </div>

      {/*
        El aviso solo aparece si hay alguno: una barra que dice «0 pacientes
        incompletos» es ruido permanente, y la que sale solo cuando hay trabajo
        pendiente se lee.
      */}
      {incompletos > 0 && (
        <button
          type="button"
          onClick={() => setSoloIncompletos((antes) => !antes)}
          aria-pressed={soloIncompletos}
          className={`mt-6 flex w-full items-center gap-2.5 rounded-2xl px-5 py-3.5 text-left text-sm transition-colors ${
            soloIncompletos
              ? 'bg-warn text-white'
              : 'bg-warn-bg text-brand-900 hover:bg-warn-bg'
          }`}
        >
          <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
          <span>
            <strong>
              {incompletos === 1
                ? '1 paciente sin completar'
                : `${incompletos} pacientes sin completar`}
            </strong>{' '}
            — les falta la cédula o el teléfono.{' '}
            {soloIncompletos ? 'Mostrando solo esos. Toca para ver todos.' : 'Toca para verlos.'}
          </span>
        </button>
      )}

      <div className="relative mt-8">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          strokeWidth={1.8}
          aria-hidden
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre, cédula, teléfono o correo"
          aria-label="Buscar pacientes"
          className="field pl-11"
        />
      </div>

      {error && (
        <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
      )}

      {/*
        Confirma lo que acaba de pasar. Sin esto, borrar una ficha se ve igual
        que si no hubiera pasado nada: la tarjeta desaparece y no queda claro si
        se borró la que era.
      */}
      {aviso && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-ok-bg px-5 py-4 text-sm text-ok">
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden />
          <span className="min-w-0 flex-1">{aviso}</span>
          <button
            type="button"
            onClick={() => setAviso(null)}
            aria-label="Cerrar el aviso"
            className="shrink-0 rounded-full p-1 hover:bg-ok-bg"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : items.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          No hay pacientes que coincidan.
        </p>
      ) : (
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((patient) => {
            const activePlan = patient.plans[0];
            const falta = textoDeLoQueFalta(patient);

            return (
              <li key={patient.id} className="relative">
                <div className="absolute right-3 top-3 z-10 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditando(patient.id)}
                    aria-label={`Editar los datos de ${patient.fullName}`}
                    title="Editar datos"
                    className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-brand-50 hover:text-brand-800"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                  </button>
                  {/*
                    Para el duplicado: la ficha repetida se quita desde la
                    lista, que es donde se ve que hay dos. Nunca de un solo
                    clic — el diálogo revisa antes qué tiene.
                  */}
                  <button
                    type="button"
                    onClick={() => setBorrando(patient)}
                    aria-label={`Borrar a ${patient.fullName}`}
                    title="Borrar paciente"
                    className="grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-bad-bg hover:text-bad"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                  </button>
                </div>
                <Link
                  href={`/admin/pacientes/${patient.id}`}
                  className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 pr-[5.5rem] transition-all hover:border-brand-300 hover:shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium leading-snug">{patient.fullName}</p>
                    {!patient.active && (
                      <span className="shrink-0 rounded-full bg-line px-2 py-0.5 text-[0.65rem] text-muted">
                        Inactivo
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {patient.phone?.trim() ? formatPhone(patient.phone) : 'Sin teléfono'}
                  </p>

                  {/*
                    Dice QUÉ falta, no solo que falta algo: con «incompleto» a
                    secas hay que abrir la ficha para averiguarlo, y son varias
                    decenas. Así se sabe desde la lista qué preguntarle al
                    paciente cuando llame.
                  */}
                  {falta && (
                    <p className="mt-2 inline-flex items-center gap-1.5 self-start rounded-lg bg-warn-bg px-2.5 py-1 text-[0.7rem] font-medium text-warn">
                      <AlertCircle className="h-3 w-3 shrink-0" strokeWidth={2.2} aria-hidden />
                      {falta}
                    </p>
                  )}

                  {activePlan ? (
                    <p className="mt-4 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-800">
                      {activePlan.title} · {activePlan._count.sessions} de{' '}
                      {activePlan.totalSessions} sesiones
                    </p>
                  ) : (
                    <p className="mt-4 text-xs text-muted">Sin plan activo</p>
                  )}

                  <p className="mt-auto pt-4 text-xs text-muted">
                    Actualizado {formatDateShort(patient.updatedAt)}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {borrando && (
        <BorrarPacienteDialog
          pacienteId={borrando.id}
          nombre={borrando.fullName}
          onCerrar={() => setBorrando(null)}
          onListo={(que) => {
            setAviso(
              que === 'borrado'
                ? `${borrando.fullName} quedó borrado.`
                : `${borrando.fullName} quedó marcado como inactivo.`,
            );
            setBorrando(null);
            void load();
          }}
        />
      )}

      {(creating || editando) && (
        <PacienteDialog
          pacienteId={editando ?? undefined}
          onCerrar={() => {
            setCreating(false);
            setEditando(null);
          }}
          onGuardado={() => {
            setCreating(false);
            setEditando(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
