'use client';

import { useCallback, useEffect, useState } from 'react';
import { Camera, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { formatDateShort } from '@/lib/format';
import { SelectorTratamiento } from '@/components/admin/SelectorTratamiento';
import { SubidaImagen } from '@/components/admin/SubidaImagen';
import { ComparadorFotos } from '@/components/admin/ComparadorFotos';
import { VisorFotos } from '@/components/admin/VisorFotos';
import type { Service } from '@/lib/types';
import { BuscadorPaciente } from '@/components/admin/BuscadorPaciente';

/**
 * Fotos de pacientes.
 *
 * Es historia clínica, no una vitrina: le sirve al profesional para comparar
 * cómo va un paciente entre una sesión y otra. Nada de lo que hay aquí sale al
 * sitio público —los casos que se muestran allá están escritos a mano en
 * `config.ts`— y las imágenes solo se sirven con sesión iniciada.
 */

type TipoFoto = 'ANTES' | 'PROGRESO' | 'DESPUES';

const TIPOS: Array<{ valor: TipoFoto; etiqueta: string }> = [
  { valor: 'ANTES', etiqueta: 'Antes' },
  { valor: 'PROGRESO', etiqueta: 'Progreso' },
  { valor: 'DESPUES', etiqueta: 'Después' },
];

/**
 * Ángulos desde los que se toma la foto.
 *
 * Es una lista cerrada y no un campo libre a propósito: el comparador solo
 * empareja el «antes» con el «después» cuando coinciden EXACTAMENTE, así que
 * un «lateral der.» escrito a mano un día y «lateral derecho» al siguiente
 * rompen la comparación sin que se note por qué.
 */
const ANGULOS = ['frontal', 'superior', 'lateral derecho', 'lateral izquierdo', 'posterior'];

/**
 * Momento y ángulo, con su etiqueta a la vista.
 *
 * Antes eran dos casillas sueltas con `aria-label`: correcto para un lector de
 * pantalla e ilegible para todos los demás, que veían aparecer la palabra
 * «frontal» sin ninguna pista de qué era. Una etiqueta que solo existe para la
 * tecnología de apoyo no es una etiqueta, es una nota al pie invisible.
 */
function CamposDeToma({
  tipo,
  angulo,
  onTipo,
  onAngulo,
  idBase,
}: {
  tipo: TipoFoto;
  angulo: string;
  onTipo: (valor: TipoFoto) => void;
  onAngulo: (valor: string) => void;
  idBase: string;
}) {
  return (
    <>
      <div>
        <label htmlFor={`${idBase}-tipo`} className="mb-1 block text-xs font-medium text-muted">
          Momento
        </label>
        <select
          id={`${idBase}-tipo`}
          value={tipo}
          onChange={(evento) => onTipo(evento.target.value as TipoFoto)}
          className="field w-auto py-2 text-sm"
        >
          {TIPOS.map((item) => (
            <option key={item.valor} value={item.valor}>
              {item.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor={`${idBase}-angulo`} className="mb-1 block text-xs font-medium text-muted">
          Ángulo de la toma
        </label>
        <select
          id={`${idBase}-angulo`}
          value={angulo}
          onChange={(evento) => onAngulo(evento.target.value)}
          className="field w-auto py-2 text-sm capitalize"
        >
          {/* Un registro viejo pudo guardar un ángulo que ya no está en la
              lista. Se añade como opción para no cambiárselo por la fuerza al
              abrir la ficha. */}
          {!ANGULOS.includes(angulo) && angulo ? (
            <option value={angulo}>{angulo}</option>
          ) : null}
          {ANGULOS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

interface Foto {
  id?: string;
  url: string;
  type: TipoFoto;
  angle: string;
  caption: string | null;
  takenAt?: string;
  sortOrder: number;
}

interface Registro {
  id: string;
  title: string;
  notes: string | null;
  consentSigned: boolean;
  createdAt: string;
  patient: { id: string; fullName: string; phone: string };
  service: { id: string; name: string } | null;
  photos: Array<Foto & { id: string }>;
}

export default function FotosPage() {
  const [items, setItems] = useState<Registro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [editando, setEditando] = useState<Registro | null>(null);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams({ take: '100' });
      if (busqueda) params.set('q', busqueda);
      const datos = await api.get<{ items: Registro[] }>(`/api/photo-records?${params}`);
      setItems(datos.items);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar los registros');
    } finally {
      setCargando(false);
    }
  }, [busqueda]);

  useEffect(() => {
    const temporizador = setTimeout(() => void cargar(), busqueda ? 400 : 0);
    return () => clearTimeout(temporizador);
  }, [cargar, busqueda]);

  async function borrar(registro: Registro) {
    if (!window.confirm(`¿Borrar el registro «${registro.title}» y sus fotos?`)) return;
    try {
      await api.delete(`/api/photo-records/${registro.id}`);
      void cargar();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos borrar el registro');
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Fotos de pacientes</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Registro fotográfico del tratamiento, para comparar la evolución. Es material clínico
            interno: no se publica en el sitio y solo se ve con sesión iniciada.
          </p>
        </div>
        <button type="button" onClick={() => setCreando(true)} className="btn-primary shrink-0">
          <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
          Nuevo registro
        </button>
      </div>

      <div className="relative mt-8">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          strokeWidth={1.8}
          aria-hidden
        />
        <input
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          placeholder="Buscar por paciente, cédula o título"
          aria-label="Buscar registros"
          className="field pl-11"
        />
      </div>

      {error && (
        <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
      )}

      {cargando ? (
        <div className="flex items-center gap-3 py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-6 py-16 text-center">
          <Camera className="mx-auto h-7 w-7 text-brand-300" strokeWidth={1.5} aria-hidden />
          <p className="mt-3 text-sm text-muted">
            {busqueda
              ? 'Ningún registro coincide con la búsqueda.'
              : 'Todavía no hay registros fotográficos.'}
          </p>
        </div>
      ) : (
        // Ahora que las tarjetas son bajas y todas iguales, caben tres por
        // fila en pantalla ancha sin que ninguna se estire.
        <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((registro) => (
            <article key={registro.id} className="rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate font-display text-lg">{registro.patient.fullName}</h2>
                  <p className="mt-0.5 truncate text-sm text-muted">{registro.title}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setEditando(registro)}
                    className="btn-outline px-3 py-1.5 text-xs"
                  >
                    Abrir
                  </button>
                  <button
                    type="button"
                    onClick={() => void borrar(registro)}
                    aria-label={`Borrar ${registro.title}`}
                    className="btn-outline px-2.5 py-1.5 text-bad hover:border-bad/40 hover:bg-bad-bg"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                  </button>
                </div>
              </div>

              <ComparadorFotos fotos={registro.photos} />

              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted">{formatDateShort(registro.createdAt)}</span>
                {registro.service && (
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">
                    {registro.service.name}
                  </span>
                )}
                <span className="rounded-full bg-line/60 px-3 py-1 text-ink/70">
                  {registro.photos.length}{' '}
                  {registro.photos.length === 1 ? 'foto' : 'fotos'}
                </span>
                {!registro.consentSigned && (
                  <span className="rounded-full bg-warn-bg px-3 py-1 text-warn">
                    Sin autorización firmada
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {(creando || editando) && (
        <RegistroDialog
          registro={editando}
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
    </div>
  );
}

function RegistroDialog({
  registro,
  onCerrar,
  onGuardado,
}: {
  registro: Registro | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  /** El paciente entero, para que el buscador pueda mostrar a quién se eligió. */
  const [paciente, setPaciente] = useState<{
    id: string;
    fullName: string;
    documentId?: string | null;
  } | null>(registro ? { id: registro.patient.id, fullName: registro.patient.fullName } : null);
  const [servicios, setServicios] = useState<Service[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    patientId: registro?.patient.id ?? '',
    serviceId: registro?.service?.id ?? '',
    title: registro?.title ?? '',
    notes: registro?.notes ?? '',
    consentSigned: registro?.consentSigned ?? false,
  });
  const [fotos, setFotos] = useState<Foto[]>(registro?.photos ?? []);
  const [nueva, setNueva] = useState<{ url: string; type: TipoFoto; angle: string }>({
    url: '',
    type: 'ANTES',
    angle: 'frontal',
  });
  /** Índice desde el que abrir el visor; `null` mientras está cerrado. */
  const [visorDesde, setVisorDesde] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        // Los pacientes ya no se traen todos: el buscador consulta al servidor
        // según se escribe, y así se puede buscar por cédula.
        const catalogo = await api.get<{ items: Service[] }>('/api/treatments');
        setServicios(catalogo.items);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No pudimos cargar los datos');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  /**
   * La foto se agrega a la lista en cuanto termina de subir. No se espera a
   * guardar el registro: si el navegador se cierra a mitad, lo que se pierde
   * es una fila, no el archivo, que ya está en el bucket.
   */
  function agregarFoto(url: string) {
    if (!url) return;
    setFotos((actuales) => [
      ...actuales,
      { url, type: nueva.type, angle: nueva.angle, caption: null, sortOrder: actuales.length },
    ]);
    setNueva((actual) => ({ ...actual, url: '' }));
  }

  function quitarFoto(indice: number) {
    setFotos((actuales) => actuales.filter((_, i) => i !== indice));
  }

  function cambiarFoto(indice: number, parche: Partial<Foto>) {
    setFotos((actuales) =>
      actuales.map((foto, i) => (i === indice ? { ...foto, ...parche } : foto)),
    );
  }

  async function guardar(evento: React.FormEvent) {
    evento.preventDefault();

    if (!form.patientId) {
      setError('Elige el paciente: una foto clínica sin paciente no es de nadie.');
      return;
    }
    if (form.title.trim().length < 3) {
      setError('Ponle un título al registro.');
      return;
    }

    setGuardando(true);
    setError(null);

    const cuerpo = {
      patientId: form.patientId,
      serviceId: form.serviceId || null,
      title: form.title,
      notes: form.notes || null,
      consentSigned: form.consentSigned,
      fotos: fotos.map((foto, indice) => ({ ...foto, sortOrder: indice })),
    };

    try {
      if (registro) {
        await api.put(`/api/photo-records/${registro.id}`, cuerpo);
      } else {
        await api.post('/api/photo-records', cuerpo);
      }
      onGuardado();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos guardar el registro');
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-5 backdrop-blur-sm">
      <form
        onSubmit={guardar}
        noValidate
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-surface p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl">
            {registro ? 'Registro fotográfico' : 'Nuevo registro'}
          </h2>
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
            Cargando…
          </div>
        ) : (
          <>
            <div className="mt-7 space-y-5">
              <div>
                <span className="field-label">Paciente *</span>
                <BuscadorPaciente
                  seleccionado={paciente}
                  onSeleccionar={(encontrado) => {
                    setPaciente({
                      id: encontrado.id,
                      fullName: encontrado.fullName,
                      documentId: encontrado.documentId,
                    });
                    setForm((actual) => ({ ...actual, patientId: encontrado.id }));
                  }}
                  onQuitar={() => {
                    setPaciente(null);
                    setForm((actual) => ({ ...actual, patientId: '' }));
                  }}
                />
              </div>

              <div>
                <label htmlFor="reg-titulo" className="field-label">
                  Título *
                </label>
                <input
                  id="reg-titulo"
                  value={form.title}
                  onChange={(evento) => setForm({ ...form, title: evento.target.value })}
                  className="field"
                  placeholder="Evolución zona frontal"
                />
              </div>

              <div>
                <label htmlFor="reg-tratamiento" className="field-label">
                  Tratamiento <span className="font-normal text-muted">(opcional)</span>
                </label>
                <SelectorTratamiento
                  id="reg-tratamiento"
                  value={form.serviceId}
                  onChange={(serviceId) => setForm({ ...form, serviceId })}
                  servicios={servicios}
                  onCreado={(servicio) => setServicios((actual) => [...actual, servicio])}
                  placeholder="Sin asociar"
                  className="field flex-1"
                />
              </div>

              <div>
                <label htmlFor="reg-notas" className="field-label">
                  Notas <span className="font-normal text-muted">(opcional)</span>
                </label>
                <textarea
                  id="reg-notas"
                  rows={2}
                  maxLength={1000}
                  value={form.notes}
                  onChange={(evento) => setForm({ ...form, notes: evento.target.value })}
                  className="field resize-none"
                  placeholder="Condiciones de la toma, observaciones…"
                />
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-50 p-4 text-sm leading-relaxed text-brand-900">
                <input
                  type="checkbox"
                  checked={form.consentSigned}
                  onChange={(evento) =>
                    setForm({ ...form, consentSigned: evento.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-brand-300 text-brand-700 focus:ring-brand-500"
                />
                <span>
                  El paciente firmó la autorización para ser fotografiado. Hace falta aunque las
                  fotos no se publiquen: la Ley 1581 cubre el tratamiento del dato, no solo su
                  difusión.
                </span>
              </label>
            </div>

            {/* ---- Fotos ---------------------------------------------- */}
            <div className="mt-8 border-t border-line pt-6">
              <h3 className="font-display text-lg">Fotos</h3>

              {fotos.length > 0 && (
                <ul className="mt-4 space-y-3">
                  {fotos.map((foto, indice) => (
                    <li
                      key={foto.id ?? `${foto.url}-${indice}`}
                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-3"
                    >
                      {/* Sin optimizador: la ruta exige la cookie de sesión y el
                          optimizador de Next pide la imagen desde el servidor,
                          sin cookies. */}
                      <button
                        type="button"
                        onClick={() => setVisorDesde(indice)}
                        aria-label="Ampliar la foto"
                        className="shrink-0 overflow-hidden rounded-xl transition-opacity hover:opacity-80"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={foto.url} alt="" className="h-16 w-16 object-cover" />
                      </button>
                      <CamposDeToma
                        idBase={`foto-${indice}`}
                        tipo={foto.type}
                        angulo={foto.angle}
                        onTipo={(type) => cambiarFoto(indice, { type })}
                        onAngulo={(angle) => cambiarFoto(indice, { angle })}
                      />
                      <button
                        type="button"
                        onClick={() => quitarFoto(indice)}
                        aria-label="Quitar la foto"
                        className="btn-outline ml-auto self-end px-2.5 py-1.5 text-bad hover:border-bad/40 hover:bg-bad-bg"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 rounded-2xl border border-dashed border-line p-4">
                <p className="mb-3 text-sm font-medium text-ink">Agregar una foto</p>

                <div className="flex flex-wrap gap-3">
                  <CamposDeToma
                    idBase="nueva"
                    tipo={nueva.type}
                    angulo={nueva.angle}
                    onTipo={(type) => setNueva({ ...nueva, type })}
                    onAngulo={(angle) => setNueva({ ...nueva, angle })}
                  />
                </div>

                <div className="mt-4">
                  <SubidaImagen
                    carpeta="galeria"
                    label="Archivos"
                    valor={nueva.url}
                    onChange={agregarFoto}
                    multiple
                  />
                </div>

                <p className="mt-2 text-xs text-muted">
                  Elige el momento y el ángulo antes de subir: todas las que subas en esta tanda
                  se agregan con lo que esté marcado aquí. Después se puede cambiar en cada fila.
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
                ) : (
                  'Guardar registro'
                )}
              </button>
              <button type="button" onClick={onCerrar} className="btn-outline px-6">
                Cancelar
              </button>
            </div>
          </>
        )}
      </form>

      {visorDesde !== null && (
        <VisorFotos
          fotos={fotos}
          indiceInicial={visorDesde}
          onCerrar={() => setVisorDesde(null)}
        />
      )}
    </div>
  );
}
