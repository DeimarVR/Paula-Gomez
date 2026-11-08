'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { hoyEnClinica } from '@/lib/format';
import {
  FOTOTIPOS,
  MOTIVOS_CONSULTA,
  UNIDADES_APLICACION,
  ZONAS_FACIALES,
  lineaVacia,
  type FichaFacial,
  type LineaFacial,
} from '@/lib/fichaFacial';
import { SelectorTratamiento } from '@/components/admin/SelectorTratamiento';
import type { Service } from '@/lib/types';
import { BuscadorPaciente } from '@/components/admin/BuscadorPaciente';

/**
 * Formulario de la ficha facial.
 *
 * A diferencia de la hoja capilar, esto NO es la réplica de un papel: no existe
 * un talonario facial que copiar. Por eso es un formulario normal, en bloques,
 * en vez de una hoja medida al milímetro — y por eso también resulta bastante
 * más simple de mantener.
 */

interface Props {
  /** Ficha existente al editar; ausente al crear. */
  inicial?: FichaFacial;
}

interface Producto {
  id: string;
  name: string;
  unit: string;
  stock: number;
}

export function FichaFacialForm({ inicial }: Props) {
  const router = useRouter();

  /** El paciente elegido, para que el buscador muestre a quién. */
  const [paciente, setPaciente] = useState<{
    id: string;
    fullName: string;
    documentId?: string | null;
  } | null>(
    inicial?.patientId
      ? { id: inicial.patientId, fullName: inicial.patientName ?? '', documentId: inicial.patientDocument }
      : null,
  );
  const [servicios, setServicios] = useState<Service[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  const [ficha, setFicha] = useState<FichaFacial>(
    inicial ?? {
      patientId: '',
      openedAt: hoyEnClinica(),
      patientName: '',
      patientDocument: '',
      patientAge: '',
      patientPhone: '',
      skinType: '',
      skinCondition: '',
      concerns: [],
      allergies: '',
      contraindications: '',
      notes: '',
      entries: [lineaVacia(hoyEnClinica())],
    },
  );

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        // Los pacientes ya no vienen todos de golpe: el buscador los consulta
        // según se escribe, y así se puede buscar también por cédula.
        const [s, inv] = await Promise.all([
          api.get<{ items: Service[] }>('/api/treatments'),
          api.get<{ items: Producto[] }>('/api/inventario'),
        ]);
        setServicios(s.items);
        setProductos(inv.items);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No pudimos cargar los datos');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  /**
   * Al elegir paciente se copian sus datos a la ficha.
   *
   * Se copian, no se enlazan: la ficha es un documento clínico y tiene que
   * seguir diciendo la edad y el teléfono de ese día aunque mañana cambien.
   */
  function elegirPaciente(encontrado: {
    id: string;
    fullName: string;
    documentId: string | null;
    phone: string;
  }) {
    setPaciente({
      id: encontrado.id,
      fullName: encontrado.fullName,
      documentId: encontrado.documentId,
    });
    setFicha((actual) => ({
      ...actual,
      patientId: encontrado.id,
      patientName: encontrado.fullName,
      patientDocument: encontrado.documentId ?? actual.patientDocument,
      patientPhone: encontrado.phone ?? actual.patientPhone,
    }));
  }

  function cambiar(parche: Partial<FichaFacial>) {
    setFicha((actual) => ({ ...actual, ...parche }));
  }

  function cambiarLinea(indice: number, parche: Partial<LineaFacial>) {
    setFicha((actual) => ({
      ...actual,
      entries: actual.entries.map((linea, i) => (i === indice ? { ...linea, ...parche } : linea)),
    }));
  }

  function alternarZona(indice: number, zona: string) {
    const linea = ficha.entries[indice];
    const zonas = linea.zones.includes(zona)
      ? linea.zones.filter((z) => z !== zona)
      : [...linea.zones, zona];
    cambiarLinea(indice, { zones: zonas });
  }

  function alternarMotivo(motivo: string) {
    cambiar({
      concerns: ficha.concerns.includes(motivo)
        ? ficha.concerns.filter((m) => m !== motivo)
        : [...ficha.concerns, motivo],
    });
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();

    if (!ficha.patientId) {
      setError('Elige el paciente.');
      return;
    }

    setGuardando(true);
    setError(null);

    const cuerpo = {
      ...ficha,
      patientAge: ficha.patientAge ? Number(ficha.patientAge) : null,
      entries: ficha.entries.map((linea) => ({
        ...linea,
        quantity: linea.quantity ? Number(linea.quantity) : null,
      })),
    };

    try {
      if (inicial?.id) {
        await api.put(`/api/facial/${inicial.id}`, cuerpo);
      } else {
        await api.post('/api/facial', cuerpo);
      }
      router.push('/admin/control-pacientes');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos guardar la ficha');
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex items-center gap-3 py-20 text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Cargando…
      </div>
    );
  }

  return (
    <form onSubmit={guardar} noValidate className="space-y-8">
      {/* ---- Datos del paciente ---------------------------------------- */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-xl">Datos del paciente</h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="field-label">Paciente *</span>
            {inicial?.id ? (
              // En una ficha ya abierta el paciente no se toca: se enseña, no
              // se busca.
              <p className="field bg-brand-50/60">{ficha.patientName || '—'}</p>
            ) : (
              <BuscadorPaciente
                seleccionado={paciente}
                onSeleccionar={elegirPaciente}
                onQuitar={() => {
                  setPaciente(null);
                  setFicha((actual) => ({ ...actual, patientId: '' }));
                }}
              />
            )}
            {inicial?.id && (
              <p className="mt-1.5 text-xs text-muted">
                El paciente de una ficha ya abierta no se cambia. Si te equivocaste, crea otra.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="ff-nombre" className="field-label">Nombre en la ficha *</label>
            <input
              id="ff-nombre"
              value={ficha.patientName}
              onChange={(evento) => cambiar({ patientName: evento.target.value })}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="ff-fecha" className="field-label">Fecha de apertura *</label>
            <input
              id="ff-fecha"
              type="date"
              value={ficha.openedAt}
              onChange={(evento) => cambiar({ openedAt: evento.target.value })}
              className="field"
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <label htmlFor="ff-doc" className="field-label">Documento</label>
              <input
                id="ff-doc"
                value={ficha.patientDocument}
                onChange={(evento) => cambiar({ patientDocument: evento.target.value })}
                className="field"
              />
            </div>
            <div>
              <label htmlFor="ff-edad" className="field-label">Edad</label>
              <input
                id="ff-edad"
                inputMode="numeric"
                value={ficha.patientAge}
                onChange={(evento) =>
                  cambiar({ patientAge: evento.target.value.replace(/[^\d]/g, '') })
                }
                className="field tabular-nums"
              />
            </div>
          </div>

          <div>
            <label htmlFor="ff-tel" className="field-label">Teléfono</label>
            <input
              id="ff-tel"
              inputMode="tel"
              value={ficha.patientPhone}
              onChange={(evento) => cambiar({ patientPhone: evento.target.value })}
              className="field"
            />
          </div>
        </div>
      </section>

      {/* ---- Valoración de la piel -------------------------------------- */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <h2 className="font-display text-xl">Valoración de la piel</h2>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="ff-fototipo" className="field-label">Fototipo</label>
            <select
              id="ff-fototipo"
              value={ficha.skinType}
              onChange={(evento) => cambiar({ skinType: evento.target.value })}
              className="field"
            >
              <option value="">Sin determinar</option>
              {FOTOTIPOS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.etiqueta} — {f.descripcion}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-muted">
              Condiciona los parámetros y el riesgo de manchas. Se registra una vez.
            </p>
          </div>

          <div>
            <label htmlFor="ff-piel" className="field-label">Tipo de piel</label>
            <input
              id="ff-piel"
              value={ficha.skinCondition}
              onChange={(evento) => cambiar({ skinCondition: evento.target.value })}
              list="tipos-piel"
              className="field"
              placeholder="Mixta, sensible…"
            />
            <datalist id="tipos-piel">
              {['Grasa', 'Mixta', 'Seca', 'Normal', 'Sensible', 'Deshidratada'].map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="mt-5">
          <span className="field-label">Motivo de consulta</span>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS_CONSULTA.map((motivo) => (
              <button
                key={motivo}
                type="button"
                onClick={() => alternarMotivo(motivo)}
                aria-pressed={ficha.concerns.includes(motivo)}
                className={`rounded-full px-4 py-2 text-sm transition-colors ${
                  ficha.concerns.includes(motivo)
                    ? 'bg-brand-700 text-white'
                    : 'border border-line text-ink/75 hover:bg-brand-50'
                }`}
              >
                {motivo}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="ff-alergias" className="field-label">Alergias</label>
            <textarea
              id="ff-alergias"
              rows={2}
              value={ficha.allergies}
              onChange={(evento) => cambiar({ allergies: evento.target.value })}
              className="field resize-none"
            />
          </div>
          <div>
            <label htmlFor="ff-contra" className="field-label">Contraindicaciones</label>
            <textarea
              id="ff-contra"
              rows={2}
              value={ficha.contraindications}
              onChange={(evento) => cambiar({ contraindications: evento.target.value })}
              className="field resize-none"
              placeholder="Embarazo, lactancia, anticoagulantes, herpes activo…"
            />
          </div>
        </div>
      </section>

      {/* ---- Sesiones ---------------------------------------------------- */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl">Sesiones</h2>
          <button
            type="button"
            onClick={() =>
              cambiar({ entries: [...ficha.entries, lineaVacia(hoyEnClinica())] })
            }
            className="btn-outline px-4 py-2 text-sm"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
            Agregar sesión
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {ficha.entries.map((linea, indice) => (
            <article
              key={linea.id ?? indice}
              className="rounded-2xl border border-line bg-cream/40 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-base">Sesión {indice + 1}</h3>
                {ficha.entries.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      cambiar({ entries: ficha.entries.filter((_, i) => i !== indice) })
                    }
                    aria-label={`Quitar la sesión ${indice + 1}`}
                    className="btn-outline px-2.5 py-1.5 text-bad hover:border-bad/40 hover:bg-bad-bg"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                  </button>
                )}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor={`s${indice}-fecha`} className="field-label">Fecha *</label>
                  <input
                    id={`s${indice}-fecha`}
                    type="date"
                    value={linea.sessionDate}
                    onChange={(evento) => cambiarLinea(indice, { sessionDate: evento.target.value })}
                    className="field"
                  />
                </div>
                <div>
                  <label htmlFor={`s${indice}-etiqueta`} className="field-label">Nombre</label>
                  <input
                    id={`s${indice}-etiqueta`}
                    value={linea.sessionLabel}
                    onChange={(evento) =>
                      cambiarLinea(indice, { sessionLabel: evento.target.value })
                    }
                    className="field"
                    placeholder="1.ª, retoque…"
                  />
                </div>
                <div>
                  <label htmlFor={`s${indice}-serv`} className="field-label">Procedimiento</label>
                  <SelectorTratamiento
                    id={`s${indice}-serv`}
                    value={linea.serviceId}
                    onChange={(serviceId) => cambiarLinea(indice, { serviceId })}
                    servicios={servicios}
                    onCreado={(servicio) => setServicios((actual) => [...actual, servicio])}
                    placeholder="Elige…"
                    className="field flex-1"
                  />
                </div>
              </div>

              <div className="mt-4">
                <span className="field-label">Zonas tratadas</span>
                <div className="flex flex-wrap gap-1.5">
                  {ZONAS_FACIALES.map((zona) => (
                    <button
                      key={zona.id}
                      type="button"
                      onClick={() => alternarZona(indice, zona.id)}
                      aria-pressed={linea.zones.includes(zona.id)}
                      className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                        linea.zones.includes(zona.id)
                          ? 'bg-brand-700 text-white'
                          : 'border border-line text-ink/75 hover:bg-brand-50'
                      }`}
                    >
                      {zona.etiqueta}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label htmlFor={`s${indice}-prod`} className="field-label">
                    Producto <span className="font-normal text-muted">(del inventario)</span>
                  </label>
                  <select
                    id={`s${indice}-prod`}
                    value={linea.productId}
                    onChange={(evento) => {
                      const producto = productos.find((p) => p.id === evento.target.value);
                      cambiarLinea(indice, {
                        productId: evento.target.value,
                        // El nombre se copia además del enlace: dentro de dos
                        // años el producto puede ya no estar en el catálogo, y
                        // la ficha tiene que seguir diciendo qué se aplicó.
                        productName: producto?.name ?? linea.productName,
                      });
                    }}
                    className="field"
                  >
                    <option value="">Sin enlazar</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-muted">
                    Enlazarlo no descuenta el inventario: la salida se registra en Inventario.
                  </p>
                </div>

                <div>
                  <label htmlFor={`s${indice}-lote`} className="field-label">Lote</label>
                  <input
                    id={`s${indice}-lote`}
                    value={linea.lotNumber}
                    onChange={(evento) => cambiarLinea(indice, { lotNumber: evento.target.value })}
                    className="field"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor={`s${indice}-cant`} className="field-label">Cantidad</label>
                    <input
                      id={`s${indice}-cant`}
                      inputMode="decimal"
                      value={linea.quantity}
                      onChange={(evento) =>
                        cambiarLinea(indice, {
                          quantity: evento.target.value.replace(/[^\d.,]/g, '').replace(',', '.'),
                        })
                      }
                      className="field tabular-nums"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label htmlFor={`s${indice}-unidad`} className="field-label">Unidad</label>
                    <select
                      id={`s${indice}-unidad`}
                      value={linea.quantityUnit}
                      onChange={(evento) =>
                        cambiarLinea(indice, { quantityUnit: evento.target.value })
                      }
                      className="field"
                    >
                      {UNIDADES_APLICACION.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`s${indice}-tecnica`} className="field-label">Técnica</label>
                  <input
                    id={`s${indice}-tecnica`}
                    value={linea.technique}
                    onChange={(evento) => cambiarLinea(indice, { technique: evento.target.value })}
                    className="field"
                    placeholder="Puntos de aplicación, profundidad…"
                  />
                </div>
                <div>
                  <label htmlFor={`s${indice}-hallazgos`} className="field-label">Observaciones</label>
                  <input
                    id={`s${indice}-hallazgos`}
                    value={linea.findings}
                    onChange={(evento) => cambiarLinea(indice, { findings: evento.target.value })}
                    className="field"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={`s${indice}-cuidados`} className="field-label">
                    Cuidados en casa
                  </label>
                  <input
                    id={`s${indice}-cuidados`}
                    value={linea.homeCare}
                    onChange={(evento) => cambiarLinea(indice, { homeCare: evento.target.value })}
                    className="field"
                    placeholder="Protector solar, no exponerse al calor 48 h…"
                  />
                </div>
                <div>
                  <label htmlFor={`s${indice}-proximo`} className="field-label">
                    Próximo control
                  </label>
                  <input
                    id={`s${indice}-proximo`}
                    type="date"
                    value={linea.nextControl}
                    onChange={(evento) => cambiarLinea(indice, { nextControl: evento.target.value })}
                    className="field"
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    Queda anotado. La cita se agenda desde Citas.
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-6">
        <label htmlFor="ff-notas" className="field-label">Notas generales</label>
        <textarea
          id="ff-notas"
          rows={3}
          value={ficha.notes}
          onChange={(evento) => cambiar({ notes: evento.target.value })}
          className="field resize-none"
        />
      </section>

      {error && (
        <p className="rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
      )}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={guardando} className="btn-primary">
          {guardando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Guardando…
            </>
          ) : inicial?.id ? (
            'Guardar cambios'
          ) : (
            'Crear ficha'
          )}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/control-pacientes')}
          className="btn-outline px-6"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
