'use client';

import { useEffect, useRef, useState } from 'react';
import { Eraser, PenLine, Upload } from 'lucide-react';

/** Ancho máximo del PNG guardado. Una firma no necesita más resolución. */
const ANCHO_MAXIMO = 600;

interface Props {
  /** PNG en data URL, o null si aún no hay firma. */
  valor: string | null;
  onCambio: (firma: string | null) => void;
  /**
   * La línea de ayuda de abajo.
   *
   * El texto por defecto habla de la «Firma autorizada» de la factura, que es
   * donde nació este componente. En un abono eso no existe y la frase mentía:
   * decía que la firma se imprime en un sitio al que ese cobro no va. Quien lo
   * reutilice en otro sitio dice qué pasa con la firma ahí.
   */
  ayuda?: React.ReactNode;
}

/**
 * Captura la firma de quien elabora el documento.
 *
 * Se ofrecen las dos formas a propósito. Dibujar con el mouse sale torcido y
 * poco parecido a la firma real de la persona; subir una foto de la firma
 * hecha en papel queda igual a la del talonario, que es lo que se busca. En un
 * portátil con pantalla táctil o una tableta, dibujar sí funciona bien.
 *
 * La imagen se guarda como data URL dentro del documento y no en el bucket:
 * son unos pocos kilobytes, tienen que imprimirse sin pedir permisos ni
 * esperar una descarga, y así la factura es autocontenida.
 */
export function FirmaPad({ valor, onCambio, ayuda }: Props) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [modo, setModo] = useState<'dibujar' | 'imagen'>(valor ? 'imagen' : 'dibujar');
  const [error, setError] = useState<string | null>(null);

  // El canvas se dimensiona en píxeles reales de pantalla: si se deja al
  // tamaño CSS, en pantallas de alta densidad la firma sale pixelada.
  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas || modo !== 'dibujar') return;

    const escala = window.devicePixelRatio || 1;
    const caja = canvas.getBoundingClientRect();
    canvas.width = caja.width * escala;
    canvas.height = caja.height * escala;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(escala, escala);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, [modo]);

  function posicion(evento: React.PointerEvent<HTMLCanvasElement>) {
    const caja = evento.currentTarget.getBoundingClientRect();
    return { x: evento.clientX - caja.left, y: evento.clientY - caja.top };
  }

  function empezar(evento: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = lienzo.current?.getContext('2d');
    if (!ctx) return;
    // Capturar el puntero evita que el trazo se corte si el mouse se sale del
    // recuadro a mitad de la firma.
    evento.currentTarget.setPointerCapture(evento.pointerId);
    dibujando.current = true;
    const { x, y } = posicion(evento);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function trazar(evento: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = lienzo.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = posicion(evento);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    const canvas = lienzo.current;
    if (canvas) onCambio(canvas.toDataURL('image/png'));
  }

  function limpiar() {
    const canvas = lienzo.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    onCambio(null);
    setError(null);
  }

  /**
   * Reescala la foto de la firma antes de guardarla.
   *
   * Sin esto se guardaría la foto original del celular —varios megabytes— en
   * una columna de la base de datos, dentro de cada factura.
   */
  function subir(archivo: File) {
    setError(null);
    if (!archivo.type.startsWith('image/')) {
      setError('Sube una imagen (PNG o JPG) de tu firma.');
      return;
    }

    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        const escala = Math.min(1, ANCHO_MAXIMO / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setError('No pudimos procesar la imagen.');
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        onCambio(canvas.toDataURL('image/png'));
        setModo('imagen');
      };
      img.onerror = () => setError('No pudimos leer esa imagen.');
      img.src = lector.result as string;
    };
    lector.onerror = () => setError('No pudimos leer el archivo.');
    lector.readAsDataURL(archivo);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setModo('dibujar')}
          aria-pressed={modo === 'dibujar'}
          className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
            modo === 'dibujar' ? 'bg-brand-700 text-white' : 'border border-line hover:bg-brand-50'
          }`}
        >
          <PenLine className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          Dibujar
        </button>

        <label
          className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors ${
            modo === 'imagen' ? 'bg-brand-700 text-white' : 'border border-line hover:bg-brand-50'
          }`}
        >
          <Upload className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          Subir foto de la firma
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(evento) => {
              const archivo = evento.target.files?.[0];
              if (archivo) subir(archivo);
              evento.target.value = '';
            }}
          />
        </label>

        {valor && (
          <button
            type="button"
            onClick={limpiar}
            className="flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm text-muted transition-colors hover:bg-bad-bg hover:text-bad"
          >
            <Eraser className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Borrar
          </button>
        )}
      </div>

      {modo === 'dibujar' ? (
        <canvas
          ref={lienzo}
          onPointerDown={empezar}
          onPointerMove={trazar}
          onPointerUp={terminar}
          onPointerLeave={terminar}
          aria-label="Área para dibujar la firma"
          className="h-36 w-full cursor-crosshair touch-none rounded-xl border border-dashed border-line bg-white"
        />
      ) : valor ? (
        /* eslint-disable-next-line @next/next/no-img-element -- data URL local, no pasa por el optimizador */
        <img
          src={valor}
          alt="Firma cargada"
          className="h-36 w-full rounded-xl border border-line bg-white object-contain p-2"
        />
      ) : (
        <p className="flex h-36 items-center justify-center rounded-xl border border-dashed border-line bg-white text-sm text-muted">
          Sube una foto de tu firma en papel.
        </p>
      )}

      {error && <p className="mt-2 text-sm text-bad">{error}</p>}

      <p className="mt-2 text-xs text-muted">
        {ayuda ?? (
          <>
            Se imprime sobre la línea de <strong>Firma autorizada</strong>. Queda guardada en este
            documento tal como está ahora.
          </>
        )}
      </p>
    </div>
  );
}
