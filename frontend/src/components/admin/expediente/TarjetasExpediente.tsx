'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil, Pill, Plus, RotateCcw, Trash2, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { formatDateShort, formatRelative } from '@/lib/format';
import type { Expediente, Medicamento, NotaEvolucion } from '@/lib/types';

/**
 * Las tarjetas del expediente general.
 *
 * Cada una se lee igual que en la maqueta y se edita en el mismo sitio: el
 * botón «Editar» de la cabecera convierte la tarjeta en formulario, sin
 * ventanas encima. Quien está con el paciente delante no quiere perder de
 * vista lo demás para corregir una línea.
 *
 * Lo clínico lo editan la especialista y el equipo profesional (`puedeEditar`);
 * recepción lo ve. La regla de verdad está en la API.
 */

interface PropsBase {
  patientId: string;
  expediente: Expediente;
  puedeEditar: boolean;
  /** Se llama con el expediente nuevo, o sin nada para que se vuelva a pedir. */
  onCambio: (nuevo?: Expediente) => void;
}

function Aviso({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <p role="alert" className="mt-4 flex items-start gap-2 rounded-[10px] bg-bad-bg px-4 py-3 text-sm text-bad">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
      {texto}
    </p>
  );
}

function Vacio({ texto }: { texto: string }) {
  return <dd className="!text-subtle">{texto}</dd>;
}

function Botones({ guardando, onCancelar }: { guardando: boolean; onCancelar: () => void }) {
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <button type="submit" disabled={guardando} className="btn-primary btn-sm">
        {guardando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Guardar
      </button>
      <button type="button" onClick={onCancelar} className="btn-outline btn-sm">
        Cancelar
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

export function TarjetaTratamiento({ patientId, expediente, puedeEditar, onCambio }: PropsBase) {
  const t = expediente.tratamiento;
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ motivo: '', diagnostico: '', plan: '', controles: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function empezar() {
    setForm({
      motivo: t.motivo ?? '',
      diagnostico: t.diagnostico ?? '',
      plan: t.plan ?? '',
      controles: t.controlesPrevistos ? String(t.controlesPrevistos) : '',
    });
    setError(null);
    setEditando(true);
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const nuevo = await api.patch<Expediente>(`/api/patients/${patientId}/expediente`, {
        seccion: 'tratamiento',
        motivo: form.motivo,
        diagnostico: form.diagnostico,
        plan: form.plan,
        controlesPrevistos: form.controles ? Number(form.controles) : null,
      });
      onCambio(nuevo);
      setEditando(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos guardar');
    } finally {
      setGuardando(false);
    }
  }

  const avance =
    t.controlesPrevistos && t.controlesHechos !== null
      ? Math.min(100, Math.round((t.controlesHechos / t.controlesPrevistos) * 100))
      : null;

  return (
    <section className="panel-card" aria-labelledby="exp-tratamiento">
      <div className="card-head">
        <div>
          <h2 id="exp-tratamiento">Qué se está tratando</h2>
          <p>Motivo, diagnóstico y plan</p>
        </div>
        {puedeEditar && !editando && (
          <button type="button" onClick={empezar} className="btn-text">
            <Pencil className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Editar
          </button>
        )}
      </div>
      <div className="card-body">
        {editando ? (
          <form onSubmit={guardar}>
            <div className="grid gap-4">
              <label className="grid gap-1.5">
                <span className="field-label !mb-0">Motivo de consulta</span>
                <textarea rows={2} value={form.motivo} onChange={(e) => setForm({ ...form, motivo: e.target.value })} className="field resize-y" />
              </label>
              <label className="grid gap-1.5">
                <span className="field-label !mb-0">Diagnóstico o impresión</span>
                <textarea rows={2} value={form.diagnostico} onChange={(e) => setForm({ ...form, diagnostico: e.target.value })} className="field resize-y" />
              </label>
              <label className="grid gap-1.5">
                <span className="field-label !mb-0">Plan de tratamiento</span>
                <textarea rows={3} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className="field resize-y" />
              </label>
              <label className="grid gap-1.5 sm:max-w-[16rem]">
                <span className="field-label !mb-0">
                  Controles previstos <span className="font-normal text-muted">(opcional)</span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  inputMode="numeric"
                  value={form.controles}
                  onChange={(e) => setForm({ ...form, controles: e.target.value })}
                  className="field"
                />
                <span className="text-xs text-muted">
                  Se cuentan las citas atendidas desde que lo pongas. Cambiarlo empieza la cuenta de nuevo.
                </span>
              </label>
            </div>
            <Aviso texto={error} />
            <Botones guardando={guardando} onCancelar={() => setEditando(false)} />
          </form>
        ) : (
          <dl className="campos">
            <div>
              <dt>Motivo de consulta</dt>
              {t.motivo ? <dd>{t.motivo}</dd> : <Vacio texto="Sin anotar todavía." />}
            </div>
            <div>
              <dt>Diagnóstico / impresión</dt>
              {t.diagnostico ? <dd>{t.diagnostico}</dd> : <Vacio texto="Sin anotar todavía." />}
            </div>
            <div>
              <dt>Plan de tratamiento</dt>
              {t.plan ? <dd>{t.plan}</dd> : <Vacio texto="Sin anotar todavía." />}
              {avance !== null && (
                <>
                  <div
                    className="progreso"
                    role="progressbar"
                    aria-label="Avance del plan"
                    aria-valuemin={0}
                    aria-valuemax={t.controlesPrevistos ?? 0}
                    aria-valuenow={t.controlesHechos ?? 0}
                  >
                    <span style={{ width: `${avance}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-[13px] text-subtle">
                    <span>Controles realizados</span>
                    <b className="text-ink">
                      {t.controlesHechos} de {t.controlesPrevistos}
                    </b>
                  </div>
                </>
              )}
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function desde(fecha: string | null): string {
  if (!fecha) return '';
  const d = new Date(fecha);
  return `desde ${MESES_CORTOS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function TarjetaMedicacion({ patientId, expediente, puedeEditar, onCambio }: PropsBase) {
  const [agregando, setAgregando] = useState(false);
  const [form, setForm] = useState({ nombre: '', dosis: '', desde: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verSuspendidos, setVerSuspendidos] = useState(false);

  const activos = expediente.medicamentos.filter((m) => m.active);
  const suspendidos = expediente.medicamentos.filter((m) => !m.active);

  async function agregar(evento: React.FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await api.post(`/api/patients/${patientId}/medicamentos`, {
        nombre: form.nombre,
        dosis: form.dosis || null,
        desde: form.desde || null,
      });
      setForm({ nombre: '', dosis: '', desde: '' });
      setAgregando(false);
      onCambio();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos agregarlo');
    } finally {
      setGuardando(false);
    }
  }

  async function alternar(m: Medicamento) {
    setError(null);
    try {
      await api.patch(`/api/medicamentos/${m.id}`, { activo: !m.active });
      onCambio();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cambiarlo');
    }
  }

  async function borrar(m: Medicamento) {
    if (!window.confirm(`¿Borrar «${m.name}»? Solo para lo que se anotó por error; si lo dejó de tomar, suspéndelo.`)) return;
    try {
      await api.delete(`/api/medicamentos/${m.id}`);
      onCambio();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos borrarlo');
    }
  }

  return (
    <section className="panel-card" aria-labelledby="exp-medicacion">
      <div className="card-head">
        <div>
          <h2 id="exp-medicacion">Qué está tomando</h2>
          <p>Medicación actual</p>
        </div>
        {puedeEditar && !agregando && (
          <button type="button" onClick={() => setAgregando(true)} className="btn-text">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Agregar
          </button>
        )}
      </div>

      {agregando && (
        <form onSubmit={agregar} className="border-b border-line bg-cream/60 px-[22px] py-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <label className="grid gap-1.5">
              <span className="field-label !mb-0">Medicamento</span>
              <input required minLength={2} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="field" placeholder="Losartán 50 mg" />
            </label>
            <label className="grid gap-1.5">
              <span className="field-label !mb-0">
                Desde <span className="font-normal text-muted">(opcional)</span>
              </span>
              <input type="date" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} className="field" />
            </label>
            <label className="grid gap-1.5 sm:col-span-2">
              <span className="field-label !mb-0">Cómo lo toma</span>
              <input value={form.dosis} onChange={(e) => setForm({ ...form, dosis: e.target.value })} className="field" placeholder="1 tableta cada 24 h, en la mañana" />
            </label>
          </div>
          <Aviso texto={error} />
          <Botones guardando={guardando} onCancelar={() => setAgregando(false)} />
        </form>
      )}

      {activos.length === 0 ? (
        <p className="px-[22px] py-6 text-sm text-subtle">No toma nada, o no se ha anotado.</p>
      ) : (
        <ul>
          {activos.map((m) => (
            <li key={m.id} className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-1 border-b border-line px-[22px] py-3.5 last:border-b-0 sm:grid-cols-[40px_minmax(0,1fr)_auto]">
              <span className="icon-box tone-sand h-10 w-10 rounded-[10px]">
                <Pill className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden />
              </span>
              <div className="min-w-0">
                <b className="block text-[15px]">{m.name}</b>
                {m.dose && <span className="text-[13.5px] text-muted">{m.dose}</span>}
              </div>
              <div className="col-start-2 flex items-center gap-1 sm:col-start-auto sm:justify-end">
                <span className="whitespace-nowrap text-[12.5px] text-subtle">{desde(m.startedOn)}</span>
                {puedeEditar && (
                  <button type="button" onClick={() => void alternar(m)} className="btn-text text-xs" title="Lo dejó de tomar">
                    Suspender
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!agregando && error && (
        <div className="px-[22px] pb-4">
          <Aviso texto={error} />
        </div>
      )}

      {(suspendidos.length > 0 || expediente.actualizado) && (
        <div className="card-foot text-[13px] text-subtle">
          {suspendidos.length > 0 && (
            <button type="button" onClick={() => setVerSuspendidos((v) => !v)} className="font-semibold text-brand-600 hover:underline">
              {verSuspendidos ? 'Ocultar' : 'Ver'} lo que ya no toma ({suspendidos.length})
            </button>
          )}
          {verSuspendidos && (
            <ul className="mt-2 grid gap-1.5">
              {suspendidos.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 line-through decoration-subtle/50">
                    {m.name}
                    {m.dose ? ` · ${m.dose}` : ''}
                  </span>
                  {m.endedOn && <span>hasta {formatDateShort(m.endedOn)}</span>}
                  {puedeEditar && (
                    <>
                      <button type="button" onClick={() => void alternar(m)} className="btn-text text-xs">
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                        Volver a activar
                      </button>
                      <button type="button" onClick={() => void borrar(m)} className="btn-text text-xs text-bad hover:bg-bad-bg" aria-label={`Borrar ${m.name}`}>
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          {expediente.actualizado && (
            <p className={suspendidos.length > 0 ? 'mt-2' : ''}>
              Expediente actualizado {expediente.actualizado.por ? `por ${expediente.actualizado.por} · ` : ''}
              {formatRelative(expediente.actualizado.en)}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------------- */

export function TarjetaAntecedentes({ patientId, expediente, puedeEditar, onCambio }: PropsBase) {
  const a = expediente.antecedentes;
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ alergias: '', personales: '', quirurgicos: '', familiares: '' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function empezar() {
    setForm({
      alergias: a.alergias ?? '',
      personales: a.personales ?? '',
      quirurgicos: a.quirurgicos ?? '',
      familiares: a.familiares ?? '',
    });
    setError(null);
    setEditando(true);
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const nuevo = await api.patch<Expediente>(`/api/patients/${patientId}/expediente`, {
        seccion: 'antecedentes',
        ...form,
      });
      onCambio(nuevo);
      setEditando(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos guardar');
    } finally {
      setGuardando(false);
    }
  }

  const campos: Array<[keyof typeof form, string, string]> = [
    ['alergias', 'Alergias', 'Penicilina (reacción en la piel)'],
    ['personales', 'Antecedentes personales', 'Hipertensión diagnosticada en 2023'],
    ['quirurgicos', 'Cirugías', 'Apendicectomía (2015)'],
    ['familiares', 'Antecedentes familiares', 'Madre con diabetes tipo 2'],
  ];

  return (
    <section className="panel-card" aria-labelledby="exp-antecedentes">
      <div className="card-head">
        <div>
          <h2 id="exp-antecedentes">Antecedentes y alergias</h2>
        </div>
        {puedeEditar && !editando && (
          <button type="button" onClick={empezar} className="btn-text">
            <Pencil className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Editar
          </button>
        )}
      </div>
      <div className="card-body">
        {editando ? (
          <form onSubmit={guardar}>
            <div className="grid gap-4">
              {campos.map(([clave, etiqueta, ejemplo]) => (
                <label key={clave} className="grid gap-1.5">
                  <span className="field-label !mb-0">{etiqueta}</span>
                  <textarea
                    rows={2}
                    value={form[clave]}
                    onChange={(e) => setForm({ ...form, [clave]: e.target.value })}
                    className="field resize-y"
                    placeholder={ejemplo}
                  />
                </label>
              ))}
            </div>
            <Aviso texto={error} />
            <Botones guardando={guardando} onCancelar={() => setEditando(false)} />
          </form>
        ) : (
          <dl className="campos">
            {campos.map(([clave, etiqueta]) => (
              <div key={clave}>
                <dt>{etiqueta}</dt>
                {a[clave] ? (
                  <dd className={clave === 'alergias' ? 'font-semibold !text-bad' : undefined}>{a[clave]}</dd>
                ) : (
                  <Vacio texto={clave === 'alergias' ? 'Ninguna conocida, o sin preguntar.' : 'Nada anotado.'} />
                )}
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------- */

function cuandoFue(nota: NotaEvolucion): string {
  const fecha = new Date(nota.noteDate);
  const hoy = new Date();
  const mismoDia = fecha.toDateString() === hoy.toDateString();
  return mismoDia ? 'Hoy' : formatDateShort(nota.noteDate);
}

export function TarjetaNotas({
  patientId,
  expediente,
  puedeEditar,
  onCambio,
  usuarioId,
  esAdmin,
  limite,
  abrirNueva,
  onNuevaAbierta,
}: PropsBase & {
  usuarioId: string | null;
  esAdmin: boolean;
  /** En el resumen se enseñan las últimas; en su pestaña, todas. */
  limite?: number;
  /** El botón «Nueva nota» de la cabecera del paciente la abre desde fuera. */
  abrirNueva?: boolean;
  onNuevaAbierta?: () => void;
}) {
  const [escribiendo, setEscribiendo] = useState(false);
  const [texto, setTexto] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abrirNueva || !puedeEditar) return;
    setEscribiendo(true);
    onNuevaAbierta?.();
  }, [abrirNueva, puedeEditar, onNuevaAbierta]);

  const notas = limite ? expediente.notas.slice(0, limite) : expediente.notas;

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      if (editandoId) {
        await api.patch(`/api/notas/${editandoId}`, { texto });
      } else {
        await api.post(`/api/patients/${patientId}/notas`, { texto });
      }
      setTexto('');
      setEscribiendo(false);
      setEditandoId(null);
      onCambio();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos guardar la nota');
    } finally {
      setGuardando(false);
    }
  }

  function editar(nota: NotaEvolucion) {
    setEditandoId(nota.id);
    setTexto(nota.body);
    setEscribiendo(true);
    setError(null);
  }

  function cancelar() {
    setEscribiendo(false);
    setEditandoId(null);
    setTexto('');
  }

  return (
    <section className="panel-card" aria-labelledby="exp-notas">
      <div className="card-head">
        <div>
          <h2 id="exp-notas">Notas de evolución</h2>
          <p>De la más reciente a la primera</p>
        </div>
        {puedeEditar && !escribiendo && (
          <button type="button" onClick={() => setEscribiendo(true)} className="btn-text">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Nueva
          </button>
        )}
      </div>

      {escribiendo && (
        <form onSubmit={guardar} className="border-b border-line bg-cream/60 px-[22px] py-4">
          <label htmlFor="nota-texto" className="field-label">
            {editandoId ? 'Corregir la nota' : 'Lo que se vio y se decidió hoy'}
          </label>
          <textarea
            id="nota-texto"
            rows={4}
            required
            minLength={3}
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="field resize-y"
            placeholder="Tensión 128/82. Tolera bien el tratamiento. Control en 4 semanas."
          />
          <Aviso texto={error} />
          <Botones guardando={guardando} onCancelar={cancelar} />
        </form>
      )}

      <div className="card-body">
        {notas.length === 0 ? (
          <p className="text-sm text-subtle">Todavía no hay notas.</p>
        ) : (
          <ol className="linea-tiempo">
            {notas.map((nota) => (
              <li key={nota.id}>
                <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-subtle">
                  <span>
                    <b className="font-semibold text-ink">{cuandoFue(nota)}</b> · {nota.authorName}
                  </span>
                  {puedeEditar && (nota.authorId === usuarioId || esAdmin) && editandoId !== nota.id && (
                    <button type="button" onClick={() => editar(nota)} className="font-semibold text-brand-600 hover:underline">
                      Corregir
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-line text-[14.5px] text-ink">{nota.body}</p>
              </li>
            ))}
          </ol>
        )}
        {limite && expediente.notas.length > limite && (
          <p className="mt-4 text-[13px] text-subtle">
            Y {expediente.notas.length - limite} más en la pestaña «Evolución».
          </p>
        )}
      </div>
    </section>
  );
}
