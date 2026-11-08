'use client';

import { useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2 } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { SubidaImagen } from '@/components/admin/SubidaImagen';

/**
 * Imágenes del sitio público.
 *
 * Existe para que cambiar la foto del inicio no dependa de que alguien abra el
 * código. Lo que se sube aquí sale en la portada en cuanto se guarda: la ruta
 * se revalida desde el servidor, así que no hay que esperar los cinco minutos
 * del ciclo normal ni volver a publicar.
 */

interface Imagenes {
  hero: string | null;
  nosotros: string | null;
}

const SECCIONES = [
  {
    clave: 'hero' as const,
    titulo: 'Portada',
    ayuda:
      'La foto grande que se ve al entrar, al lado del titular. Se recorta a lo alto, así que funciona mejor una imagen vertical o cuadrada.',
  },
  {
    clave: 'nosotros' as const,
    titulo: 'Nosotros',
    ayuda:
      'La foto de la especialista o del equipo, en la sección «Nosotros».',
  },
];

export default function SitioPage() {
  const [imagenes, setImagenes] = useState<Imagenes>({ hero: null, nosotros: null });
  const [original, setOriginal] = useState<Imagenes>({ hero: null, nosotros: null });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const datos = await api.get<Imagenes>('/api/site');
        setImagenes(datos);
        setOriginal(datos);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'No pudimos cargar los ajustes');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const hayCambios =
    imagenes.hero !== original.hero || imagenes.nosotros !== original.nosotros;

  function cambiar(clave: keyof Imagenes, ruta: string) {
    setImagenes((actual) => ({ ...actual, [clave]: ruta || null }));
    setGuardado(false);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    setGuardado(false);

    try {
      // Se manda la cadena vacía, no `null`: es lo que el servidor entiende
      // como «quita la imagen y vuelve al marcador».
      const datos = await api.put<Imagenes>('/api/site', {
        hero: imagenes.hero ?? '',
        nosotros: imagenes.nosotros ?? '',
      });
      setImagenes(datos);
      setOriginal(datos);
      setGuardado(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos guardar los cambios');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">Sitio web</h1>
          <p className="mt-2 text-muted">
            Las fotos de la página de inicio. Se cambian desde aquí, sin tocar el código.
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline shrink-0 text-sm"
        >
          Ver el sitio
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
        </a>
      </div>

      {cargando ? (
        <div className="flex items-center gap-3 py-20 text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Cargando…
        </div>
      ) : (
        <>
          <div className="mt-8 space-y-6">
            {SECCIONES.map((seccion) => (
              <section key={seccion.clave} className="rounded-2xl border border-line bg-surface p-6">
                <h2 className="font-display text-lg">{seccion.titulo}</h2>
                <p className="mt-1 mb-4 text-sm text-muted">{seccion.ayuda}</p>

                <SubidaImagen
                  carpeta="sitio"
                  label={`Foto de ${seccion.titulo.toLowerCase()}`}
                  valor={imagenes[seccion.clave] ?? ''}
                  onChange={(ruta) => cambiar(seccion.clave, ruta)}
                />

                {!imagenes[seccion.clave] && (
                  <p className="mt-3 text-xs text-muted">
                    Sin foto propia: ahí sale el marcador de diseño.
                  </p>
                )}
              </section>
            ))}
          </div>

          {error && (
            <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
          )}

          {guardado && !hayCambios && (
            <p className="mt-6 flex items-center gap-2 rounded-2xl bg-brand-50 px-5 py-4 text-sm text-brand-800">
              <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
              Listo. El sitio ya está mostrando estas fotos.
            </p>
          )}

          <button
            type="button"
            onClick={() => void guardar()}
            disabled={guardando || !hayCambios}
            className="btn-primary mt-8 w-full"
          >
            {guardando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : (
              'Guardar cambios'
            )}
          </button>

          <p className="mt-4 text-center text-xs text-muted">
            El logo no se cambia desde aquí: necesita también su versión clara para los fondos
            oscuros y sale además en los documentos impresos.
          </p>
        </>
      )}
    </div>
  );
}
