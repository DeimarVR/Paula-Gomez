'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { ImageUp, Loader2, X } from 'lucide-react';
import { ApiError, api } from '@/lib/apiClient';

interface SubidaImagenProps {
  /** Dónde guardar: galeria (antes/después), sesiones (clínicas), sitio. */
  carpeta: 'galeria' | 'sesiones' | 'sitio';
  /** Ruta actual, si ya hay imagen. */
  valor: string;
  /** Se llama una vez por cada archivo subido con éxito. */
  onChange: (ruta: string) => void;
  label: string;
  className?: string;
  /**
   * Permite elegir varios archivos de una vez.
   *
   * En este modo no se dibuja la vista previa: la lista de lo subido la lleva
   * quien usa el componente, porque `valor` solo puede guardar una ruta y con
   * cinco fotos mostraría la última como si fuera la única.
   */
  multiple?: boolean;
}

interface RespuestaSubida {
  urlDeSubida: string;
  clave: string;
  ruta: string;
}

const TIPOS = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/**
 * Selector de imagen que sube directo al bucket.
 *
 * El archivo no pasa por la API: esta pide una URL firmada y el navegador
 * escribe contra el bucket. Es lo que permite subir una foto de celular sin
 * chocar con el límite de 4,5 MB por petición de las funciones de Vercel.
 *
 * No hay campo para pegar una dirección: las fotos salen del computador o del
 * celular de quien atiende, no de un enlace. El que había obligaba a escribir
 * una URL absoluta y rechazaba la ruta que devuelve la propia subida
 * (`/api/archivos/...`), así que bloqueaba el formulario justo después de
 * subir bien la imagen.
 */
export function SubidaImagen({
  carpeta,
  valor,
  onChange,
  label,
  className = '',
  multiple = false,
}: SubidaImagenProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  /** "2 de 5" mientras va una tanda. `null` cuando no hay nada en curso. */
  const [avance, setAvance] = useState<{ actual: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Sube un archivo. Devuelve la ruta, o lanza para que decida quien llama. */
  async function subirUno(archivo: File): Promise<string> {
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

    return ruta;
  }

  /**
   * Sube la tanda, uno detrás de otro.
   *
   * En serie y no en paralelo: son fotos de cámara o de celular, y cinco
   * subidas simultáneas por una conexión de consultorio se estorban entre
   * ellas y suelen terminar más tarde que si van en fila. Además así el
   * contador dice algo cierto.
   *
   * Un archivo que falla NO tumba la tanda. Se avisa cuáles fallaron al final
   * y los que sí subieron quedan agregados: perder cuatro fotos buenas porque
   * la quinta se cayó sería el peor de los dos mundos.
   */
  async function subir(archivos: File[]): Promise<void> {
    setError(null);

    const admitidos = archivos.filter((archivo) => TIPOS.includes(archivo.type));
    const rechazados = archivos.length - admitidos.length;

    if (admitidos.length === 0) {
      setError('Formato no admitido. Usa JPG, PNG, WebP o AVIF.');
      if (entrada.current) entrada.current.value = '';
      return;
    }

    setSubiendo(true);
    const fallidos: string[] = [];

    for (const [indice, archivo] of admitidos.entries()) {
      setAvance({ actual: indice + 1, total: admitidos.length });
      try {
        onChange(await subirUno(archivo));
      } catch (err) {
        fallidos.push(archivo.name);
        // Se guarda el motivo del primero: repetir el mismo mensaje por cada
        // archivo no informa más y llena la pantalla.
        if (fallidos.length === 1) {
          setError(
            err instanceof ApiError || err instanceof Error
              ? err.message
              : 'No pudimos subir la imagen',
          );
        }
      }
    }

    if (rechazados > 0 || fallidos.length > 0) {
      const partes = [
        rechazados > 0 ? `${rechazados} con formato no admitido` : null,
        fallidos.length > 0 ? `no se pudo subir: ${fallidos.join(', ')}` : null,
      ].filter(Boolean);
      setError((actual) => [actual, partes.join(' · ')].filter(Boolean).join(' — '));
    }

    setSubiendo(false);
    setAvance(null);
    if (entrada.current) entrada.current.value = '';
  }

  return (
    <div className={className}>
      <span className="field-label">{label}</span>

      {/* En modo múltiple la lista la dibuja quien usa el componente. */}
      {valor && !multiple ? (
        <div className="relative mb-3 h-40 w-full overflow-hidden rounded-2xl border border-line bg-brand-50">
          {/*
            `unoptimized` no es un capricho. La foto vive en `/api/archivos`,
            una ruta que exige la cookie de sesión. El optimizador de Next pide
            la imagen desde el SERVIDOR, y esa petición no lleva cookies: la
            foto recién subida —que todavía no pertenece a ningún caso
            publicado— vuelve 401 y se ve rota. Sin optimizador la pide el
            navegador, que sí manda la cookie.
          */}
          <Image src={valor} alt="" fill sizes="320px" unoptimized className="object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Quitar la imagen"
            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-ink/70 text-white transition-colors hover:bg-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={subiendo}
          className="btn-outline px-4 py-2 text-sm"
        >
          {subiendo ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {avance && avance.total > 1
                ? `Subiendo ${avance.actual} de ${avance.total}…`
                : 'Subiendo…'}
            </>
          ) : (
            <>
              <ImageUp className="h-4 w-4" aria-hidden />
              {multiple ? 'Subir imágenes' : valor ? 'Cambiar imagen' : 'Subir imagen'}
            </>
          )}
        </button>

        <input
          ref={entrada}
          type="file"
          accept={TIPOS.join(',')}
          multiple={multiple}
          className="sr-only"
          onChange={(evento) => {
            const archivos = Array.from(evento.target.files ?? []);
            if (archivos.length > 0) void subir(archivos);
          }}
        />

        {multiple && !subiendo && (
          <span className="text-xs text-muted">Se pueden elegir varias a la vez.</span>
        )}
      </div>


      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
