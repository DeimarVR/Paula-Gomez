'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  Check,
  FileSignature,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { formatDateShort } from '@/lib/format';
import { FirmaPad } from '@/components/admin/FirmaPad';
import { TextoConsentimiento } from '@/components/admin/TextoConsentimiento';
import { CONSENTIMIENTO_BASE } from '@/lib/consentimientoBase';
import type { AdminUser, Service } from '@/lib/types';
import { BuscadorPaciente } from '@/components/admin/BuscadorPaciente';

/** Lo mínimo del paciente que necesita el chip del buscador. */
interface PacienteElegido {
  id: string;
  fullName: string;
  documentId: string | null;
}

/**
 * Consentimientos informados.
 *
 * Dos cosas separadas en la misma pantalla, y conviene que se vean separadas:
 * las PLANTILLAS —el texto que redactó el centro, que se corrige y versiona— y
 * lo FIRMADO —lo que un paciente aceptó un día concreto, que no se toca nunca
 * más—.
 */

interface Plantilla {
  id: string;
  name: string;
  description: string | null;
  /** El consentimiento en sí, en texto plano. */
  body: string;
  version: number;
  active: boolean;
  services: Array<{ id: string; name: string }>;
  _count: { signatures: number };
}

interface Firmado {
  id: string;
  templateName: string;
  templateVersion: number;
  patientName: string;
  patientDocument: string | null;
  signedAt: string;
  fileUrl: string;
  professionalName: string | null;
  patient: { id: string; fullName: string };
}

export default function ConsentimientosPage() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [firmados, setFirmados] = useState<Firmado[]>([]);
  const [servicios, setServicios] = useState<Service[]>([]);
  const [vista, setVista] = useState<'plantillas' | 'firmados'>('plantillas');
  const [verArchivadas, setVerArchivadas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<AdminUser | null>(null);

  const [editando, setEditando] = useState<Plantilla | null>(null);
  const [creando, setCreando] = useState(false);
  const [firmando, setFirmando] = useState<Plantilla | null>(null);
  const [leyendo, setLeyendo] = useState<Plantilla | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [p, f, s] = await Promise.all([
        api.get<{ items: Plantilla[] }>(
          `/api/consentimientos${verArchivadas ? '?incluirInactivas=true' : ''}`,
        ),
        api.get<{ items: Firmado[] }>('/api/consentimientos/firmas'),
        api.get<{ items: Service[] }>('/api/treatments'),
      ]);
      setPlantillas(p.items);
      setFirmados(f.items);
      setServicios(s.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar los consentimientos');
    } finally {
      setCargando(false);
    }
  }, [verArchivadas]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    void api
      .get<{ user: AdminUser }>('/api/auth/me')
      .then((r) => setUsuario(r.user))
      .catch(() => setUsuario(null));
  }, []);

  /**
   * Archivar es la única salida desde la lista de activos.
   *
   * Antes este botón borraba cuando nadie había firmado y archivaba cuando sí:
   * la misma acción con dos finales, decididos por un dato que no estaba a la
   * vista. Y la pantalla ofrecía «Ver archivadas» sin nada que pareciera
   * archivar. Ahora se archiva siempre, y el borrado definitivo vive en la
   * vista de archivados, que es donde uno ya está mirando lo que quiere
   * limpiar.
   */
  async function archivar(plantilla: Plantilla) {
    if (
      !window.confirm(
        `¿Archivar «${plantilla.name}»? Deja de aparecer al firmar, pero no se pierde: se puede reactivar cuando quieras. Lo que ya firmaron los pacientes no se toca.`,
      )
    ) {
      return;
    }

    try {
      await api.delete(`/api/consentimientos/${plantilla.id}`);
      setAviso(`«${plantilla.name}» se archivó.`);
      void cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos archivar el consentimiento');
    }
  }

  async function eliminar(plantilla: Plantilla) {
    const firmas = plantilla._count.signatures;
    const advertencia =
      firmas > 0
        ? `\n\nLos ${firmas} documento(s) que ya firmaron los pacientes NO se borran y siguen siendo válidos, pero dejarán de estar agrupados bajo este consentimiento.`
        : '';

    if (
      !window.confirm(
        `¿Borrar «${plantilla.name}» definitivamente? Se pierde el texto y no hay forma de recuperarlo.${advertencia}`,
      )
    ) {
      return;
    }

    try {
      await api.delete(`/api/consentimientos/${plantilla.id}?definitivo=true`);
      setAviso(`«${plantilla.name}» se borró definitivamente.`);
      void cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos borrar el consentimiento');
    }
  }

  async function reactivar(plantilla: Plantilla) {
    try {
      await api.delete(`/api/consentimientos/${plantilla.id}?activa=true`);
      setAviso(`«${plantilla.name}» volvió a la lista.`);
      void cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos reactivar el consentimiento');
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Consentimientos</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Los textos que redactó el centro, y lo que cada paciente firmó.
          </p>
        </div>
        <button type="button" onClick={() => setCreando(true)} className="btn-primary shrink-0">
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Nuevo consentimiento
        </button>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-line bg-surface p-1">
          {(['plantillas', 'firmados'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVista(v)}
              aria-pressed={vista === v}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                vista === v ? 'bg-brand-700 text-white' : 'text-ink/70 hover:bg-brand-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {vista === 'plantillas' && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={verArchivadas}
              onChange={(evento) => setVerArchivadas(evento.target.checked)}
              className="h-4 w-4 rounded border-brand-300 text-brand-700 focus:ring-brand-500"
            />
            Ver archivadas
          </label>
        )}
      </div>

      {error && <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>}
      {aviso && (
        <p className="mt-6 rounded-2xl bg-brand-50 px-5 py-4 text-sm text-brand-800">{aviso}</p>
      )}

      {cargando ? (
        <div className="flex items-center gap-3 py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : vista === 'plantillas' ? (
        plantillas.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
            <FileText className="mx-auto h-7 w-7 text-brand-300" strokeWidth={1.5} aria-hidden />
            <p className="mt-3 text-sm text-muted">
              Todavía no hay consentimientos cargados. Sube el PDF que el centro tiene redactado.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {plantillas.map((plantilla) => (
              <article
                key={plantilla.id}
                className="rounded-2xl border border-line bg-surface p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className={`font-display text-lg ${plantilla.active ? '' : 'text-muted'}`}>
                      {plantilla.name}
                    </h2>
                    {!plantilla.active && (
                      <span className="mt-1 inline-block rounded-full bg-line/60 px-2 py-0.5 text-[0.65rem] text-ink/60">
                        Archivado
                      </span>
                    )}
                    {plantilla.description && (
                      <p className="mt-1 text-sm text-muted">{plantilla.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-50 px-3 py-1 text-xs text-brand-700">
                    v{plantilla.version}
                  </span>
                </div>

                {plantilla.services.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {plantilla.services.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-full border border-line px-3 py-1 text-xs text-ink/70"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {plantilla.active ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setFirmando(plantilla)}
                        className="btn-primary px-4 py-2 text-sm"
                      >
                        <FileSignature className="h-4 w-4" strokeWidth={2} aria-hidden />
                        Firmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeyendo(plantilla)}
                        className="btn-outline px-3 py-2 text-sm"
                      >
                        Leer
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditando(plantilla)}
                        aria-label={`Editar ${plantilla.name}`}
                        className="btn-outline px-2.5 py-2"
                      >
                        <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                      </button>
                      {/*
                        Archivar, sin más. Tenga firmas o no: un solo concepto,
                        reversible, y el borrado de verdad vive en la vista de
                        archivados.
                      */}
                      {usuario?.role === 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() => void archivar(plantilla)}
                          title="Deja de aparecer al firmar. Se puede reactivar."
                          className="btn-outline px-3 py-2 text-sm"
                        >
                          <Archive className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                          Archivar
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void reactivar(plantilla)}
                        className="btn-outline px-4 py-2 text-sm"
                      >
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                        Reactivar
                      </button>
                      <button
                        type="button"
                        onClick={() => setLeyendo(plantilla)}
                        className="btn-outline px-3 py-2 text-sm"
                      >
                        Leer
                      </button>
                      {usuario?.role === 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() => void eliminar(plantilla)}
                          title="Se pierde el texto. No tiene vuelta."
                          className="btn-outline px-3 py-2 text-sm text-bad hover:border-bad/40 hover:bg-bad-bg"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                          Borrar
                        </button>
                      )}
                    </>
                  )}

                  <span className="ml-auto text-xs text-muted">
                    {plantilla._count.signatures}{' '}
                    {plantilla._count.signatures === 1 ? 'firma' : 'firmas'}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )
      ) : firmados.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center text-sm text-muted">
          Todavía no hay consentimientos firmados.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-line bg-cream/60 text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-5 py-4 font-medium">Fecha</th>
                <th scope="col" className="px-5 py-4 font-medium">Paciente</th>
                <th scope="col" className="px-5 py-4 font-medium">Documento</th>
                <th scope="col" className="px-5 py-4 font-medium">Atendió</th>
                <th scope="col" className="px-5 py-4 text-right font-medium">PDF</th>
              </tr>
            </thead>
            <tbody>
              {firmados.map((firma) => (
                <tr key={firma.id} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-4 text-muted">{formatDateShort(firma.signedAt)}</td>
                  <td className="px-5 py-4 font-medium">{firma.patientName}</td>
                  <td className="px-5 py-4">
                    {firma.templateName}
                    <span className="ml-2 text-xs text-muted">v{firma.templateVersion}</span>
                  </td>
                  <td className="px-5 py-4 text-muted">{firma.professionalName ?? '—'}</td>
                  <td className="px-5 py-4 text-right">
                    <a
                      href={firma.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-outline px-3 py-1.5 text-xs"
                    >
                      Abrir
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(creando || editando) && (
        <PlantillaDialog
          plantilla={editando}
          servicios={servicios}
          onCerrar={() => {
            setCreando(false);
            setEditando(null);
          }}
          onGuardado={() => {
            setCreando(false);
            setEditando(null);
            void cargar();
          }}
        />
      )}

      {leyendo && (
        <LectorDialog plantilla={leyendo} onCerrar={() => setLeyendo(null)} />
      )}

      {firmando && (
        <FirmaDialog
          plantilla={firmando}
          onCerrar={() => setFirmando(null)}
          onFirmado={() => {
            setFirmando(null);
            setVista('firmados');
            void cargar();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Lectura
 * ------------------------------------------------------------------ */

/** El consentimiento tal como se va a imprimir, para leerlo sin firmar nada. */
function LectorDialog({ plantilla, onCerrar }: { plantilla: Plantilla; onCerrar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-5 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-8">
        <h2 className="font-display text-2xl">{plantilla.name}</h2>
        <p className="mt-1 text-sm text-muted">
          Versión {plantilla.version}
          {plantilla.description ? ` · ${plantilla.description}` : ''}
        </p>

        <div className="mt-6 rounded-2xl border border-line bg-cream/40 p-6">
          <TextoConsentimiento texto={plantilla.body} />
        </div>

        <button type="button" onClick={onCerrar} className="btn-outline mt-6 w-full">
          Cerrar
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Alta y edición de plantilla
 * ------------------------------------------------------------------ */

function PlantillaDialog({
  plantilla,
  servicios,
  onCerrar,
  onGuardado,
}: {
  plantilla: Plantilla | null;
  servicios: Service[];
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState({
    name: plantilla?.name ?? '',
    description: plantilla?.description ?? '',
    /**
     * Al crear se arranca con el modelo en vez de con la hoja en blanco.
     * Redactar un consentimiento desde cero delante de una caja vacía es la
     * clase de tarea que se pospone para siempre; corregir un borrador, no.
     */
    body: plantilla?.body ?? CONSENTIMIENTO_BASE,
    serviceIds: plantilla?.services.map((s) => s.id) ?? [],
  });
  const [guardando, setGuardando] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function alternarServicio(id: string) {
    setForm((actual) => ({
      ...actual,
      serviceIds: actual.serviceIds.includes(id)
        ? actual.serviceIds.filter((s) => s !== id)
        : [...actual.serviceIds, id],
    }));
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    if (form.name.trim().length < 3) {
      setError('Ponle un nombre al consentimiento.');
      return;
    }
    if (form.body.trim().length < 120) {
      setError('El texto del consentimiento está demasiado corto.');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      if (plantilla) {
        await api.put(`/api/consentimientos/${plantilla.id}`, form);
      } else {
        await api.post('/api/consentimientos', form);
      }
      onGuardado();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos guardar el consentimiento');
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-5 backdrop-blur-sm">
      <form
        onSubmit={enviar}
        noValidate
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-surface p-8"
      >
        <h2 className="font-display text-2xl">
          {plantilla ? 'Editar consentimiento' : 'Nuevo consentimiento'}
        </h2>
        <p className="mt-1 text-sm text-muted">
          El texto que leerá y firmará el paciente. Lo que ya firmaron los pacientes no cambia.
        </p>

        <div className="mt-7 space-y-5">
          <div>
            <label htmlFor="c-nombre" className="field-label">Nombre *</label>
            <input
              id="c-nombre"
              value={form.name}
              onChange={(evento) => setForm({ ...form, name: evento.target.value })}
              className="field"
              placeholder="Consentimiento para procedimiento en consultorio"
            />
          </div>

          <div>
            <label htmlFor="c-desc" className="field-label">
              Descripción <span className="font-normal text-muted">(opcional)</span>
            </label>
            <textarea
              id="c-desc"
              rows={2}
              value={form.description}
              onChange={(evento) => setForm({ ...form, description: evento.target.value })}
              className="field resize-none"
            />
          </div>

          <div>
            <label htmlFor="c-texto" className="field-label">
              Texto del consentimiento *
            </label>
            <textarea
              id="c-texto"
              rows={18}
              value={form.body}
              onChange={(evento) => setForm({ ...form, body: evento.target.value })}
              /*
                En el celular, 16px y tipografía normal. Por debajo de 16px iOS
                hace zoom al enfocar el campo y no lo deshace, que es el fallo
                que ya habíamos corregido en el resto del panel; y la
                monoespaciada, que en pantalla ancha ayuda a ver las MAYÚSCULAS
                de los títulos, en 390px deja treinta caracteres por línea.
                La altura también se recorta: dieciocho filas en un móvil son
                una pantalla y media de caja antes de llegar a los botones.
              */
              className="field h-56 text-base leading-relaxed sm:h-[28rem] sm:font-mono sm:text-[13px]"
              spellCheck
            />
            <p className="mt-1.5 text-xs text-muted">
              Escríbelo como lo dirías en papel. Una línea EN MAYÚSCULAS sale como título de
              sección y una que empieza por «-» sale como viñeta. El PDF se arma solo al firmar.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setVistaPrevia((estaba) => !estaba)}
            className="btn-outline w-full text-sm"
          >
            {vistaPrevia ? 'Ocultar la vista previa' : 'Ver cómo queda'}
          </button>

          {vistaPrevia && (
            <div className="rounded-2xl border border-line bg-cream/40 p-6">
              <TextoConsentimiento texto={form.body} />
            </div>
          )}

          {plantilla && (
            <p className="rounded-xl bg-warn-bg px-4 py-3 text-xs text-warn">
              Si cambias el texto, la versión sube a v{plantilla.version + 1}. Las firmas
              anteriores conservan la versión con la que se firmaron.
            </p>
          )}

          <div>
            <span className="field-label">Procedimientos a los que aplica</span>
            <div className="flex flex-wrap gap-1.5">
              {servicios.map((servicio) => (
                <button
                  key={servicio.id}
                  type="button"
                  onClick={() => alternarServicio(servicio.id)}
                  aria-pressed={form.serviceIds.includes(servicio.id)}
                  className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                    form.serviceIds.includes(servicio.id)
                      ? 'bg-brand-700 text-white'
                      : 'border border-line text-ink/75 hover:bg-brand-50'
                  }`}
                >
                  {servicio.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Un mismo consentimiento puede cubrir varios servicios parecidos.
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="submit" disabled={guardando} className="btn-primary flex-1">
            {guardando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : plantilla ? (
              'Guardar cambios'
            ) : (
              'Nuevo consentimiento'
            )}
          </button>
          <button type="button" onClick={onCerrar} className="btn-outline px-6">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Firma
 * ------------------------------------------------------------------ */

function FirmaDialog({
  plantilla,
  onCerrar,
  onFirmado,
}: {
  plantilla: Plantilla;
  onCerrar: () => void;
  onFirmado: () => void;
}) {
  /**
   * El paciente entero y no solo su id: el buscador necesita mostrar a quién se
   * eligió, y con la cédula al lado —que es lo que distingue a dos homónimos
   * cuando lo que se está firmando es un consentimiento—.
   */
  const [paciente, setPaciente] = useState<PacienteElegido | null>(null);
  const patientId = paciente?.id ?? '';
  const [firma, setFirma] = useState<string | null>(null);
  const [notas, setNotas] = useState('');
  const [leido, setLeido] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();

    if (!patientId) {
      setError('Elige el paciente que va a firmar.');
      return;
    }
    if (!leido) {
      setError('Confirma que el paciente leyó el documento y pudo preguntar.');
      return;
    }
    if (!firma) {
      setError('Falta la firma del paciente.');
      return;
    }

    setGuardando(true);
    setError(null);
    try {
      await api.post('/api/consentimientos/firmas', {
        templateId: plantilla.id,
        patientId,
        signature: firma,
        notes: notas || null,
      });
      onFirmado();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos guardar la firma');
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-5 backdrop-blur-sm">
      <form
        onSubmit={enviar}
        noValidate
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-8"
      >
        <h2 className="font-display text-2xl">{plantilla.name}</h2>
        <p className="mt-1 text-sm text-muted">
          El paciente lee el documento y firma. Se guarda un PDF cerrado con su firma.
        </p>

        {/*
          El documento se lee aquí mismo. Antes era un enlace que abría el PDF
          en otra pestaña, y en el momento de firmar eso dejaba al paciente
          mirando un visor de archivos mientras alguien buscaba la pestaña.
        */}
        <div className="mt-6 max-h-72 overflow-y-auto rounded-2xl border border-line bg-cream/40 p-6">
          <TextoConsentimiento texto={plantilla.body} />
        </div>

        <div className="mt-6 space-y-5">
          <div>
            <span className="field-label">Paciente *</span>
            <BuscadorPaciente
              seleccionado={paciente}
              onSeleccionar={(encontrado) =>
                setPaciente({
                  id: encontrado.id,
                  fullName: encontrado.fullName,
                  documentId: encontrado.documentId,
                })
              }
              onQuitar={() => setPaciente(null)}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-50 p-4 text-sm leading-relaxed text-brand-900">
            <input
              type="checkbox"
              checked={leido}
              onChange={(evento) => setLeido(evento.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-300 text-brand-700 focus:ring-brand-500"
            />
            <span>
              El paciente leyó el documento, se le explicó el procedimiento con sus riesgos y
              alternativas, y pudo preguntar lo que necesitaba.
            </span>
          </label>

          <div>
            <span className="field-label">Firma del paciente *</span>
            <FirmaPad valor={firma} onCambio={setFirma} />
          </div>

          <div>
            <label htmlFor="f-notas" className="field-label">
              Observaciones <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id="f-notas"
              value={notas}
              onChange={(evento) => setNotas(evento.target.value)}
              className="field"
              placeholder="Firmó acompañado de su madre…"
            />
          </div>
        </div>

        {error && (
          <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="submit" disabled={guardando} className="btn-primary flex-1">
            {guardando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                Guardar consentimiento firmado
              </>
            )}
          </button>
          <button type="button" onClick={onCerrar} className="btn-outline px-6">
            Cancelar
          </button>
        </div>

        <p className="mt-4 text-xs text-muted">
          La fecha y la hora las pone el servidor, no el equipo desde el que se firma.
        </p>
      </form>
    </div>
  );
}
