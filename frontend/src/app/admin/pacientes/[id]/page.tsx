'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronRight,
  Copy,
  IdCard,
  Link2,
  Loader2,
  MessageCircle,
  NotebookPen,
  Pencil,
  Phone,
  ShieldAlert,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { api, ApiError } from '@/lib/apiClient';
import { FUNCIONES } from '@/lib/config';
import { buildWhatsAppLink, fechaHoraCorta, formatPhone, iniciales } from '@/lib/format';
import { BorrarPacienteDialog } from '@/components/admin/BorrarPacienteDialog';
import { HistorialPaciente } from '@/components/admin/HistorialPaciente';
import { FichasDelPaciente } from '@/components/admin/FichasDelPaciente';
import { PacienteDialog } from '@/components/admin/PacienteDialog';
import {
  TarjetaAntecedentes,
  TarjetaMedicacion,
  TarjetaNotas,
  TarjetaTratamiento,
} from '@/components/admin/expediente/TarjetasExpediente';
import { HistorialEnPapel } from '@/components/admin/expediente/HistorialEnPapel';
import type { AdminUser, Expediente } from '@/lib/types';

/** La ficha que devuelve GET /api/patients/:id */
interface PatientDetail {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  documentId: string | null;
  birthDate: string | null;
  city: string | null;
  photoConsent: boolean;
  active: boolean;
  publicToken: string;
  createdAt: string;
  trackingUrl: string;
  whatsappLink: string;
}

type Pestana = 'resumen' | 'evolucion' | 'papel' | 'actividad';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function edad(nacimiento: string | null): number | null {
  if (!nacimiento) return null;
  const n = new Date(nacimiento);
  const hoy = new Date();
  let anios = hoy.getUTCFullYear() - n.getUTCFullYear();
  const antes =
    hoy.getUTCMonth() < n.getUTCMonth() ||
    (hoy.getUTCMonth() === n.getUTCMonth() && hoy.getUTCDate() < n.getUTCDate());
  if (antes) anios -= 1;
  return anios >= 0 && anios < 130 ? anios : null;
}

/**
 * El expediente del paciente.
 *
 * Arriba, quién es y lo que no se puede pasar por alto: la alergia en rojo,
 * la próxima cita. Debajo, en el resumen, las cinco cosas del expediente
 * general. Las demás pestañas son para ir más hondo: todas las notas, todas
 * las hojas en papel, y la actividad (citas, consentimientos, fotos).
 */
export default function ExpedientePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [expediente, setExpediente] = useState<Expediente | null>(null);
  const [usuario, setUsuario] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<Pestana>('resumen');
  const [copied, setCopied] = useState(false);
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [nuevaNota, setNuevaNota] = useState(false);

  const cargarPaciente = useCallback(async () => {
    try {
      setPatient(await api.get<PatientDetail>(`/api/patients/${params.id}`));
      setError(null);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos cargar el paciente');
    }
  }, [params.id]);

  const cargarExpediente = useCallback(async () => {
    try {
      setExpediente(await api.get<Expediente>(`/api/patients/${params.id}/expediente`));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'No pudimos cargar el expediente');
    }
  }, [params.id]);

  useEffect(() => {
    void cargarPaciente();
    void cargarExpediente();
    void api
      .get<{ user: AdminUser }>('/api/auth/me')
      .then((r) => setUsuario(r.user))
      .catch(() => setUsuario(null));
  }, [cargarPaciente, cargarExpediente]);

  const alCambiar = useCallback(
    (nuevo?: Expediente) => {
      if (nuevo) setExpediente(nuevo);
      else void cargarExpediente();
    },
    [cargarExpediente],
  );

  const notaAbierta = useCallback(() => setNuevaNota(false), []);

  async function copyTrackingUrl() {
    if (!patient) return;
    await navigator.clipboard.writeText(patient.trackingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error && !patient) {
    return (
      <div className="mx-auto max-w-3xl">
        <p role="alert" className="flex items-start gap-2 rounded-[10px] bg-bad-bg px-5 py-4 text-sm text-bad">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
          {error}
        </p>
        <Link href="/admin/pacientes" className="btn-outline mt-6">
          Volver a pacientes
        </Link>
      </div>
    );
  }

  if (!patient || !expediente) {
    return (
      <div className="flex items-center gap-3 py-20 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Cargando expediente…
      </div>
    );
  }

  const puedeEditar = usuario?.role === 'ADMIN' || usuario?.role === 'PROFESIONAL';
  const anios = edad(patient.birthDate);
  const desde = new Date(expediente.primeraAtencion ?? patient.createdAt);

  const props = { patientId: patient.id, expediente, puedeEditar, onCambio: alCambiar };

  return (
    <div className="mx-auto grid max-w-[76rem] gap-6">
      <div>
        <nav className="crumbs" aria-label="Ruta">
          <Link href="/admin/pacientes">Pacientes</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          <span aria-current="page" className="truncate">
            {patient.fullName}
          </span>
        </nav>

        <div className="card relative flex flex-wrap items-center gap-5 overflow-hidden p-6 [background:linear-gradient(110deg,rgb(var(--brand-50))_0%,rgb(var(--surface))_42%,rgb(var(--surface))_68%,rgb(var(--accent-100))_100%)]">
          <span
            className="avatar h-16 w-16 font-display text-xl shadow-[0_0_0_4px_rgb(var(--surface)),0_10px_20px_-12px_rgb(var(--ink)/0.6)]"
            aria-hidden
          >
            {iniciales(patient.fullName)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.85rem] leading-tight">{patient.fullName}</h1>
            <div className="mt-1.5 flex flex-wrap gap-x-[18px] gap-y-1.5 text-sm text-muted">
              {anios !== null && (
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-[15px] w-[15px] text-subtle" strokeWidth={1.8} aria-hidden />
                  {anios} años
                </span>
              )}
              {patient.documentId && (
                <span className="inline-flex items-center gap-1.5">
                  <IdCard className="h-[15px] w-[15px] text-subtle" strokeWidth={1.8} aria-hidden />
                  CC {patient.documentId}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-[15px] w-[15px] text-subtle" strokeWidth={1.8} aria-hidden />
                {formatPhone(patient.phone)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {expediente.antecedentes.alergias && (
                <span className="badge-bad max-w-full">
                  <ShieldAlert strokeWidth={2.2} aria-hidden />
                  <span className="truncate">Alergia: {expediente.antecedentes.alergias}</span>
                </span>
              )}
              {expediente.proximaCita && (
                <span className="badge-info">
                  <CalendarClock strokeWidth={2.2} aria-hidden />
                  Próxima cita: {fechaHoraCorta(expediente.proximaCita.startsAt)}
                </span>
              )}
              <span className="badge-neutral">
                Paciente desde {MESES[desde.getMonth()]} {desde.getFullYear()}
              </span>
              {!patient.active && <span className="badge-warn">Inactivo</span>}
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-2 md:ml-auto md:w-auto">
            {puedeEditar && (
              <button
                type="button"
                onClick={() => {
                  setPestana('resumen');
                  setNuevaNota(true);
                }}
                className="btn-outline btn-sm"
              >
                <NotebookPen className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                Nueva nota
              </button>
            )}
            <a
              href={buildWhatsAppLink(patient.phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline btn-sm"
            >
              <MessageCircle className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              WhatsApp
            </a>
            <Link href="/admin/citas?nueva=1" className="btn-primary btn-sm">
              <CalendarPlus className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              Agendar
            </Link>
          </div>
        </div>
      </div>

      {!patient.photoConsent && (
        <p className="flex items-start gap-2 rounded-[10px] bg-warn-bg px-5 py-3.5 text-sm text-warn">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
          No ha firmado la autorización de uso de imagen: sus fotos no se pueden publicar.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-[10px] bg-bad-bg px-5 py-3.5 text-sm text-bad">
          {error}
        </p>
      )}

      <div className="tabs" role="tablist" aria-label="Secciones del expediente">
        {(
          [
            ['resumen', 'Resumen'],
            ['evolucion', `Evolución (${expediente.notas.length})`],
            ['papel', `Historial en papel (${expediente.hojas.length})`],
            ['actividad', 'Citas y documentos'],
          ] as const
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            role="tab"
            aria-selected={pestana === valor}
            onClick={() => setPestana(valor)}
            className="tab"
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {pestana === 'resumen' && (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <TarjetaTratamiento {...props} />
          <TarjetaMedicacion {...props} />
          <TarjetaAntecedentes {...props} />
          <TarjetaNotas
            {...props}
            usuarioId={usuario?.id ?? null}
            esAdmin={usuario?.role === 'ADMIN'}
            limite={3}
            abrirNueva={nuevaNota}
            onNuevaAbierta={notaAbierta}
          />
          <div className="lg:col-span-2">
            <HistorialEnPapel
              patientId={patient.id}
              hojas={expediente.hojas}
              puedeBorrar={usuario?.role === 'ADMIN'}
              onCambio={() => void cargarExpediente()}
            />
          </div>
        </div>
      )}

      {pestana === 'evolucion' && (
        <TarjetaNotas {...props} usuarioId={usuario?.id ?? null} esAdmin={usuario?.role === 'ADMIN'} />
      )}

      {pestana === 'papel' && (
        <HistorialEnPapel
          patientId={patient.id}
          hojas={expediente.hojas}
          puedeBorrar={usuario?.role === 'ADMIN'}
          onCambio={() => void cargarExpediente()}
        />
      )}

      {pestana === 'actividad' && (
        <div className="grid gap-6">
          {/* Las fichas del centro anterior. Ver FUNCIONES.fichasClinicas. */}
          {FUNCIONES.fichasClinicas && <FichasDelPaciente patientId={patient.id} />}
          <HistorialPaciente patientId={patient.id} />
        </div>
      )}

      {/* Datos y acciones que se usan poco: abajo, para no competir con lo clínico. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
        <button type="button" onClick={() => setEditando(true)} className="btn-outline btn-sm">
          <Pencil className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          Editar datos personales
        </button>
        {FUNCIONES.seguimientoPaciente && (
          <>
            <a href={patient.whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
              <Link2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              Enviar seguimiento
            </a>
            <button type="button" onClick={() => void copyTrackingUrl()} className="btn-outline btn-sm">
              {copied ? <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden /> : <Copy className="h-4 w-4" strokeWidth={1.8} aria-hidden />}
              {copied ? 'Copiado' : 'Copiar enlace de seguimiento'}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setBorrando(true)}
          className="btn btn-sm ml-auto border-line bg-surface text-bad hover:border-bad/40 hover:bg-bad-bg"
        >
          <Trash2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          Borrar paciente
        </button>
      </div>

      {editando && (
        <PacienteDialog
          pacienteId={patient.id}
          onCerrar={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            void cargarPaciente();
          }}
        />
      )}

      {borrando && (
        <BorrarPacienteDialog
          pacienteId={patient.id}
          nombre={patient.fullName}
          onCerrar={() => setBorrando(false)}
          onListo={(que) => {
            setBorrando(false);
            // Borrado: esta pantalla ya no existe, así que se vuelve a la lista.
            if (que === 'borrado') router.push('/admin/pacientes');
            else void cargarPaciente();
          }}
        />
      )}
    </div>
  );
}
