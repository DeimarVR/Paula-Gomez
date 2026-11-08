'use client';

import { useState } from 'react';
import { ArrowRight, CalendarCheck, CalendarClock, CheckCircle2, Loader2, MessageCircle, TriangleAlert } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { CITA } from '@/lib/agenda';
import { buildWhatsAppLink } from '@/lib/format';

type Estado = 'abierta' | 'suya' | 'tomada' | 'vencida' | 'cita-cambiada';

export interface DatosOferta {
  estado: Estado;
  rechazada: boolean;
  nuevo: { startsAt: string; texto: string };
  actual: { startsAt: string; texto: string };
  duracionMin: number;
  clinic: { name: string; address: string; whatsapp: string };
}

const CERRADA: Record<Exclude<Estado, 'abierta' | 'suya'>, { titulo: string; texto: string }> = {
  tomada: {
    titulo: 'Este espacio ya fue tomado',
    texto: 'Otra persona lo tomó antes. Su cita se mantiene igual; si se libera otro, le avisamos.',
  },
  vencida: {
    titulo: 'Este espacio ya no está disponible',
    texto: 'Se acercó la hora y se cerró la oferta. Su cita se mantiene igual.',
  },
  'cita-cambiada': {
    titulo: 'Su cita cambió',
    texto: 'Desde que le enviamos el mensaje su cita se movió o se canceló, así que este espacio ya no aplica.',
  },
};

/**
 * «Se liberó un espacio, ¿quiere adelantar su cita?».
 *
 * Una sola decisión, con las dos fechas a la vista: la que se ofrece y la que
 * ya tiene. El botón grande toma el espacio; el pequeño dice que no le sirve,
 * que no cambia nada pero deja de contar para recepción. Si ya lo tomó otra
 * persona, se dice sin rodeos y se aclara que su cita sigue igual.
 */
export function OfertaDeHueco({ token, oferta }: { token: string; oferta: DatosOferta }) {
  const [estado, setEstado] = useState<Estado>(oferta.estado);
  const [rechazada, setRechazada] = useState(oferta.rechazada);
  const [ocupado, setOcupado] = useState<'aceptar' | 'rechazar' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function aceptar() {
    setOcupado('aceptar');
    setError(null);
    try {
      const r = await api.post<DatosOferta>(`/api/public/ofertas/${token}/aceptar`, undefined, { auth: false });
      setEstado(r.estado);
    } catch (caught) {
      const mensaje = caught instanceof Error ? caught.message : 'No pudimos tomar el espacio';
      setError(mensaje);
      // El servidor ya dijo por qué: se refleja en la pantalla sin recargar.
      if (/tomado/i.test(mensaje)) setEstado('tomada');
      else if (/ya no está disponible/i.test(mensaje)) setEstado('vencida');
      else if (/cambió/i.test(mensaje)) setEstado('cita-cambiada');
    } finally {
      setOcupado(null);
    }
  }

  async function rechazar() {
    setOcupado('rechazar');
    try {
      await api.post(`/api/public/ofertas/${token}/rechazar`, undefined, { auth: false });
      setRechazada(true);
    } finally {
      setOcupado(null);
    }
  }

  const escribir = buildWhatsAppLink(oferta.clinic.whatsapp, 'Hola, les escribo por el espacio que se liberó en la agenda.');

  if (estado === 'suya') {
    return (
      <div className="text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ok-bg text-ok">
          <CheckCircle2 className="h-8 w-8" strokeWidth={2} aria-hidden />
        </span>
        <h1 className="mt-6 text-[clamp(2rem,4vw,2.6rem)]">Listo, su cita se adelantó</h1>
        <p className="lead mt-3">
          Ahora es el <strong className="font-semibold text-ink">{oferta.nuevo.texto}</strong>, y ya está
          confirmada. Le llega la confirmación por WhatsApp.
        </p>
        <p className="mt-6 text-sm text-muted">
          {oferta.clinic.name} · {oferta.clinic.address}
        </p>
      </div>
    );
  }

  if (estado !== 'abierta') {
    const { titulo, texto } = CERRADA[estado];
    return (
      <div className="text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-leaf-100 text-muted">
          <CalendarClock className="h-8 w-8" strokeWidth={1.8} aria-hidden />
        </span>
        <h1 className="mt-6 text-[clamp(1.9rem,4vw,2.4rem)]">{titulo}</h1>
        <p className="lead mt-3">{texto}</p>
        {estado !== 'cita-cambiada' && (
          <p className="mt-5 text-[15px] text-muted">
            Su cita sigue el <strong className="text-ink">{oferta.actual.texto}</strong>.
          </p>
        )}
        <a href={escribir} target="_blank" rel="noopener noreferrer" className="btn-outline mt-7">
          <MessageCircle className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          Escribir por WhatsApp
        </a>
      </div>
    );
  }

  return (
    <div>
      <span className="eyebrow">Se liberó un espacio</span>
      <h1 className="mt-3.5 text-[clamp(2rem,4.4vw,2.8rem)] leading-[1.1]">
        ¿Quiere <em className="font-normal italic text-brand-600">adelantar</em> su cita?
      </h1>
      <p className="lead mt-3">El espacio queda para la primera persona que lo tome.</p>

      <div className="mt-7 grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-subtle">Su cita ahora</p>
          <p className="mt-1.5 text-[15px] font-semibold text-muted first-letter:uppercase">{oferta.actual.texto}</p>
        </div>
        <ArrowRight className="mx-auto h-5 w-5 rotate-90 text-accent-700 sm:rotate-0" strokeWidth={1.8} aria-hidden />
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.06em] text-brand-600">Espacio libre</p>
          <p className="mt-1.5 text-[15px] font-semibold text-ink first-letter:uppercase">{oferta.nuevo.texto}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        {CITA.nombre} de {oferta.duracionMin} minutos · {oferta.clinic.address}
      </p>

      {error && (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-[10px] bg-bad-bg px-4 py-3 text-sm text-bad">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
          {error}
        </p>
      )}

      <div className="mt-7 grid gap-3">
        <button type="button" onClick={() => void aceptar()} disabled={ocupado !== null} className="btn-primary w-full">
          {ocupado === 'aceptar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CalendarCheck className="h-4 w-4" strokeWidth={1.8} aria-hidden />}
          Sí, quiero ese espacio
        </button>
        {rechazada ? (
          <p className="text-center text-sm text-muted">Entendido. Su cita se mantiene igual; puede tomarlo igual mientras siga libre.</p>
        ) : (
          <button type="button" onClick={() => void rechazar()} disabled={ocupado !== null} className="btn-ghost w-full">
            No me sirve, mantengo mi cita
          </button>
        )}
      </div>

      <p className="mt-8 text-center text-[13px] text-subtle">
        ¿Dudas?{' '}
        <a href={escribir} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-600 underline">
          Escríbanos por WhatsApp
        </a>
      </p>
    </div>
  );
}
