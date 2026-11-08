'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';
import { ApiError, api } from '@/lib/apiClient';

/**
 * Selector de PDF que sube directo al bucket.
 *
 * Misma mecánica que `SubidaImagen` —la API firma una URL y el navegador
 * escribe contra el bucket, esquivando el límite de tamaño de las funciones—,
 * pero para PDF y sin vista previa: un consentimiento se revisa abriéndolo, no
 * mirando una miniatura.
 */

interface Props {
  carpeta: 'consentimientos';
  valor: string;
  onChange: (ruta: string) => void;
  label: string;
}

interface RespuestaSubida {
  urlDeSubida: string;
  ruta: string;
}

export function SubidaPdf({ carpeta, valor, onChange, label }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [nombre, setNombre] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo: File) {
    setError(null);

    if (archivo.type !== 'application/pdf') {
      setError('El consentimiento tiene que ser un PDF.');
      if (entrada.current) entrada.current.value = '';
      return;
    }

    setSubiendo(true);
    try {
      const { urlDeSubida, ruta } = await api.post<RespuestaSubida>('/api/uploads', {
        carpeta,
        contentType: archivo.type,
        size: archivo.size,
      });

      const respuesta = await fetch(urlDeSubida, {
        method: 'PUT',
        body: archivo,
        headers: { 'Content-Type': archivo.type },
      });

      // El bucket contesta directo al navegador: si falla aquí y no en la API,
      // lo más probable es que falte configurar CORS en el bucket.
      if (!respuesta.ok) {
        throw new Error(
          `El bucket rechazó la subida (${respuesta.status}). Revisa la configuración de CORS.`,
        );
      }

      setNombre(archivo.name);
      onChange(ruta);
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error ? err.message : 'No pudimos subir el PDF',
      );
    } finally {
      setSubiendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  }

  return (
    <div>
      <span className="field-label">{label}</span>

      {valor ? (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-line bg-brand-50 p-4">
          <FileText className="h-5 w-5 shrink-0 text-brand-700" strokeWidth={1.8} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{nombre ?? 'Documento cargado'}</p>
            <a
              href={valor}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-700 underline underline-offset-2"
            >
              Abrir para revisarlo
            </a>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setNombre(null);
            }}
            aria-label="Quitar el PDF"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted hover:bg-white"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={subiendo}
        className="btn-outline px-4 py-2 text-sm"
      >
        {subiendo ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Subiendo…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" aria-hidden />
            {valor ? 'Cambiar el PDF' : 'Subir el PDF'}
          </>
        )}
      </button>

      <input
        ref={entrada}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(evento) => {
          const archivo = evento.target.files?.[0];
          if (archivo) void subir(archivo);
        }}
      />

      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
