'use client';

import { useRef, useState } from 'react';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { formatDateShort, hoyEnClinica } from '@/lib/format';
import type { HojaEnPapel } from '@/lib/types';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf'];
const TITULOS = ['Hoja de ingreso', 'Control', 'Fórmula médica', 'Examen', 'Consentimiento en papel'];

interface RespuestaSubida {
  urlDeSubida: string;
  ruta: string;
}

/**
 * Historial en papel: las hojas que se llenan a mano, fotografiadas.
 *
 * En consulta se sigue escribiendo en papel, y transcribirlo es trabajo que
 * nadie hace. Con esto, al terminar se le toma una foto con el celular —el
 * botón abre la cámara directamente— y queda en el expediente, privada.
 *
 * El archivo no pasa por el servidor: sube directo al bucket con una URL
 * firmada (las fotos de celular superan el límite de las funciones), y
 * después se registra en el expediente.
 */
export function HistorialEnPapel({
  patientId,
  hojas,
  puedeBorrar,
  onCambio,
}: {
  patientId: string;
  hojas: HojaEnPapel[];
  puedeBorrar: boolean;
  onCambio: () => void;
}) {
  const camara = useRef<HTMLInputElement>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const [preparando, setPreparando] = useState(false);
  const [titulo, setTitulo] = useState(TITULOS[1]);
  const [fecha, setFecha] = useState(hoyEnClinica());
  const [subiendo, setSubiendo] = useState<{ actual: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viendo, setViendo] = useState<number | null>(null);

  async function subirUno(f: File): Promise<string> {
    const { urlDeSubida, ruta } = await api.post<RespuestaSubida>('/api/uploads', {
      carpeta: 'expedientes',
      contentType: f.type,
      size: f.size,
    });
    const respuesta = await fetch(urlDeSubida, {
      method: 'PUT',
      body: f,
      headers: { 'Content-Type': f.type },
    });
    if (!respuesta.ok) {
      throw new Error(`El almacenamiento rechazó la subida (${respuesta.status}). Revisa CORS del bucket.`);
    }
    return ruta;
  }

  /**
   * Una tanda: varias páginas de una misma hoja, o varias hojas del mismo
   * día. Van en fila —por una conexión de consultorio, en paralelo se
   * estorban— y si una falla, las buenas se guardan igual.
   */
  async function subir(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    setError(null);
    const archivos = Array.from(lista).filter((f) => TIPOS.includes(f.type));
    if (archivos.length === 0) {
      setError('Ese formato no se admite. Usa una foto (JPG, PNG, WebP) o un PDF.');
      return;
    }

    const subidas: Array<{ ruta: string; tipo: string }> = [];
    let fallo: string | null = null;
    for (const [indice, f] of archivos.entries()) {
      setSubiendo({ actual: indice + 1, total: archivos.length });
      try {
        subidas.push({ ruta: await subirUno(f), tipo: f.type });
      } catch (caught) {
        fallo ??= caught instanceof Error ? caught.message : 'No pudimos subir un archivo';
      }
    }

    if (subidas.length > 0) {
      try {
        await api.post(`/api/patients/${patientId}/hojas`, {
          hojas: subidas.map((s, i) => ({
            titulo: subidas.length > 1 ? `${titulo} (${i + 1} de ${subidas.length})` : titulo,
            fecha,
            ruta: s.ruta,
            tipo: s.tipo,
          })),
        });
        setPreparando(false);
        onCambio();
      } catch (caught) {
        fallo ??= caught instanceof Error ? caught.message : 'No pudimos guardar las hojas';
      }
    }

    setSubiendo(null);
    if (fallo) setError(fallo);
    if (camara.current) camara.current.value = '';
    if (archivo.current) archivo.current.value = '';
  }

  async function borrar(hoja: HojaEnPapel) {
    if (!window.confirm(`¿Borrar «${hoja.title}»? Se borra también el archivo y no se puede deshacer.`)) return;
    try {
      await api.delete(`/api/hojas/${hoja.id}`);
      setViendo(null);
      onCambio();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos borrarla');
    }
  }

  const actual = viendo !== null ? hojas[viendo] : null;

  return (
    <section className="panel-card" aria-labelledby="exp-papel">
      <div className="card-head flex-wrap">
        <div>
          <h2 id="exp-papel">Historial en papel</h2>
          <p>Fotos de las hojas que se diligencian a mano, guardadas en el expediente</p>
        </div>
        {!preparando && (
          <button type="button" onClick={() => setPreparando(true)} className="btn-outline btn-sm">
            <Camera className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Agregar hoja
          </button>
        )}
      </div>

      <div className="card-body grid gap-[18px]">
        {preparando && (
          <div className="rounded-xl border border-line bg-cream/60 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="field-label !mb-0">Qué hoja es</span>
                <input
                  list="titulos-hoja"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="field"
                />
                <datalist id="titulos-hoja">
                  {TITULOS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </label>
              <label className="grid gap-1.5">
                <span className="field-label !mb-0">De qué día</span>
                <input type="date" value={fecha} max={hoyEnClinica()} onChange={(e) => setFecha(e.target.value)} className="field" />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {/* `capture` abre la cámara del celular directamente; en el computador abre el selector. */}
              <input
                ref={camara}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => void subir(e.target.files)}
                tabIndex={-1}
              />
              <input
                ref={archivo}
                type="file"
                accept={TIPOS.join(',')}
                multiple
                className="sr-only"
                onChange={(e) => void subir(e.target.files)}
                tabIndex={-1}
              />
              <button
                type="button"
                onClick={() => camara.current?.click()}
                disabled={Boolean(subiendo) || titulo.trim().length < 2}
                className="btn-primary btn-sm"
              >
                <Camera className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                Tomar foto
              </button>
              <button
                type="button"
                onClick={() => archivo.current?.click()}
                disabled={Boolean(subiendo) || titulo.trim().length < 2}
                className="btn-outline btn-sm"
              >
                <Upload className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                Subir archivos
              </button>
              <button type="button" onClick={() => setPreparando(false)} disabled={Boolean(subiendo)} className="btn-text">
                Cancelar
              </button>
            </div>
            {subiendo && (
              <p className="mt-3 flex items-center gap-2 text-sm text-muted" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Subiendo {subiendo.total > 1 ? `${subiendo.actual} de ${subiendo.total}` : ''}…
              </p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-[10px] bg-bad-bg px-4 py-3 text-sm text-bad">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
            {error}
          </p>
        )}

        {hojas.length === 0 && !preparando ? (
          <button
            type="button"
            onClick={() => setPreparando(true)}
            className="grid w-full max-w-[180px] place-content-center justify-items-center gap-2.5 rounded-[10px] border-[1.5px] border-dashed border-line-strong bg-surface p-3 text-center text-sm font-semibold text-brand-700 transition-colors [aspect-ratio:3/4] hover:border-brand-600 hover:bg-brand-50"
          >
            <span className="icon-box h-12 w-12 rounded-full bg-brand-100">
              <Camera className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            </span>
            Tomar foto o subir
            <small className="text-[12.5px] font-medium text-subtle">Desde el celular o el computador</small>
          </button>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-4">
            {hojas.map((hoja, indice) => (
              <li key={hoja.id}>
                <button type="button" onClick={() => setViendo(indice)} className="group grid w-full gap-2.5 text-left">
                  <span className="relative grid place-items-center overflow-hidden rounded-[10px] border border-line bg-[linear-gradient(160deg,#E8EBEF,#DCE1E7)] transition-[border-color,box-shadow] [aspect-ratio:3/4] group-hover:border-line-strong group-hover:shadow-soft">
                    {hoja.mimeType === 'application/pdf' ? (
                      <span className="grid justify-items-center gap-1 text-subtle">
                        <FileText className="h-8 w-8" strokeWidth={1.5} aria-hidden />
                        <span className="text-xs font-semibold">PDF</span>
                      </span>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por nuestra API, sin optimizador
                      <img src={hoja.fileUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span>
                    <b className="block truncate text-sm font-semibold">{hoja.title}</b>
                    <span className="block text-[12.5px] text-subtle">
                      {hoja.sheetDate ? formatDateShort(hoja.sheetDate) : formatDateShort(hoja.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-center gap-2 text-[13px] text-subtle">
          <ShieldCheck className="h-4 w-4 text-ok" strokeWidth={1.8} aria-hidden />
          Las fotos se guardan en privado: solo las ve el equipo del centro con sesión iniciada.
        </p>
      </div>

      {actual && viendo !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-ink/90"
          role="dialog"
          aria-modal="true"
          aria-label={actual.title}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setViendo(null);
            if (e.key === 'ArrowRight' && viendo < hojas.length - 1) setViendo(viendo + 1);
            if (e.key === 'ArrowLeft' && viendo > 0) setViendo(viendo - 1);
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3 text-white">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{actual.title}</p>
              <p className="text-xs text-white/70">
                {actual.sheetDate ? formatDateShort(actual.sheetDate) : formatDateShort(actual.createdAt)}
                {actual.uploadedBy ? ` · subida por ${actual.uploadedBy}` : ''}
              </p>
            </div>
            <a href={actual.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-on-deep btn-sm">
              <ExternalLink className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              Abrir
            </a>
            {puedeBorrar && (
              <button type="button" onClick={() => void borrar(actual)} className="btn-on-deep btn-sm" aria-label="Borrar la hoja">
                <Trash2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
              </button>
            )}
            <button type="button" onClick={() => setViendo(null)} className="btn-on-deep btn-sm" aria-label="Cerrar" autoFocus>
              <X className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
            {actual.mimeType === 'application/pdf' ? (
              <iframe src={actual.fileUrl} title={actual.title} className="h-full w-full max-w-4xl rounded-lg bg-white" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- archivo privado servido por nuestra API
              <img src={actual.fileUrl} alt={actual.title} className="max-h-full max-w-full rounded-lg object-contain" />
            )}
            {viendo > 0 && (
              <button
                type="button"
                onClick={() => setViendo(viendo - 1)}
                className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
                aria-label="Hoja anterior"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
            )}
            {viendo < hojas.length - 1 && (
              <button
                type="button"
                onClick={() => setViendo(viendo + 1)}
                className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
                aria-label="Hoja siguiente"
              >
                <ChevronRight className="h-5 w-5" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
