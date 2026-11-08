'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import {
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  MessageCircle,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { CITA } from '@/lib/agenda';
import { ESPECIALISTA } from '@/lib/config';
import { buildWhatsAppLink, horaCorta } from '@/lib/format';
import { SelectorDeHorario, diaLargoDeClave } from '@/components/booking/SelectorDeHorario';
import type { AppointmentStatus, ManagedAppointment, TimeSlot } from '@/lib/types';

interface ManageAppointmentProps {
  appointment: ManagedAppointment;
  token: string;
}

const ESTADO: Record<AppointmentStatus, { texto: string; clase: string }> = {
  PENDIENTE: { texto: 'Por confirmar', clase: 'badge-warn' },
  CONFIRMADA: { texto: 'Confirmada', clase: 'badge-ok' },
  CANCELADA: { texto: 'Cancelada', clase: 'badge-bad' },
  COMPLETADA: { texto: 'Atendida', clase: 'badge-neutral' },
  NO_ASISTIO: { texto: 'No asistió', clase: 'badge-neutral' },
};

/**
 * La página de la cita, la que abre el enlace del WhatsApp.
 *
 * Desde aquí el paciente confirma, cambia la hora o cancela, sin llamar. Si
 * la especialista cerró el día de su cita, esta página lo dice primero —con la
 * disculpa a su nombre— y le pone delante el calendario para elegir otra hora.
 *
 * Cambiar la hora usa los horarios libres de verdad, con su propia hora como
 * libre. La hora que deja se ofrece sola a quien tiene cita más adelante.
 */
export function ManageAppointment({ appointment, token }: ManageAppointmentProps) {
  const [estado, setEstado] = useState<AppointmentStatus>(appointment.status);
  const [porReagendar, setPorReagendar] = useState(appointment.needsReschedule);
  const [cuando, setCuando] = useState<{ startsAt: string; texto: string }>({
    startsAt: appointment.startsAt,
    texto: appointment.formattedDate,
  });
  const [ocupado, setOcupado] = useState<'confirmar' | 'cancelar' | 'mover' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [moviendo, setMoviendo] = useState(appointment.needsReschedule);
  const [nueva, setNueva] = useState<{ slot: TimeSlot; dia: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const viva = estado === 'PENDIENTE' || estado === 'CONFIRMADA';
  const puedeMover = (viva && new Date(cuando.startsAt) > new Date()) || porReagendar;

  const elegir = useCallback((slot: TimeSlot, dia: string) => setNueva({ slot, dia }), []);

  async function confirmar() {
    setOcupado('confirmar');
    setError(null);
    try {
      await api.post(`/api/public/bookings/${token}/confirm`, undefined, { auth: false });
      setEstado('CONFIRMADA');
      setAviso('Gracias. Su cita quedó confirmada.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos confirmar su cita');
    } finally {
      setOcupado(null);
    }
  }

  async function cancelar() {
    setOcupado('cancelar');
    setError(null);
    try {
      await api.post(`/api/public/bookings/${token}/cancel`, { reason: motivo || undefined }, { auth: false });
      setEstado('CANCELADA');
      setCancelando(false);
      setAviso('Su cita quedó cancelada. Gracias por avisar: ese espacio se le ofrecerá a otra persona.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cancelar su cita');
    } finally {
      setOcupado(null);
    }
  }

  async function mover() {
    if (!nueva) return;
    setOcupado('mover');
    setError(null);
    try {
      const r = await api.post<{ startsAt: string; status: AppointmentStatus; formattedDate: string }>(
        `/api/public/bookings/${token}/reagendar`,
        { startsAt: nueva.slot.startsAt },
        { auth: false },
      );
      setCuando({ startsAt: r.startsAt, texto: r.formattedDate });
      setEstado(r.status);
      setPorReagendar(false);
      setMoviendo(false);
      setNueva(null);
      setAviso('Listo. Su cita quedó en el nuevo horario y ya está confirmada.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cambiar la hora');
    } finally {
      setOcupado(null);
    }
  }

  const escribir = buildWhatsAppLink(
    appointment.clinic.whatsapp,
    `Hola, soy ${appointment.contactName}. Le escribo por mi cita del ${cuando.texto}.`,
  );
  const fecha = new Date(cuando.startsAt);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      {porReagendar && (
        <div className="rounded-[22px] border border-warn/30 bg-warn-bg p-6 text-warn">
          <p className="flex items-center gap-2 font-semibold">
            <CalendarX className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            Ese día no habrá atención
          </p>
          <p className="mt-2 text-[15px] leading-relaxed">
            {ESPECIALISTA.nombre} le ofrece sus disculpas: tuvo que cerrar la agenda el día de su cita.
            Elija abajo el horario que mejor le quede; queda confirmado al instante.
          </p>
        </div>
      )}

      <div className="rounded-[22px] border border-line bg-surface p-6 shadow-[0_2px_4px_rgb(var(--ink)/0.04),0_36px_64px_-32px_rgb(var(--ink)/0.35)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Hola, {appointment.contactName.trim().split(/\s+/)[0]}</p>
            <h1 className="mt-1 text-[clamp(1.8rem,4vw,2.3rem)] leading-tight">Su cita</h1>
          </div>
          <span className={porReagendar ? 'badge-warn' : ESTADO[estado].clase}>
            {porReagendar ? 'Por elegir nueva hora' : ESTADO[estado].texto}
          </span>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex gap-3">
            <span className="icon-box tone-info h-11 w-11 rounded-xl">
              <CalendarCheck className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <dt className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-subtle">
                {porReagendar ? 'Era el' : 'Cuándo'}
              </dt>
              <dd className={`text-[15px] font-semibold first-letter:uppercase ${porReagendar ? 'text-subtle line-through' : ''}`}>
                {diaLargoDeClave(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(fecha))} ·{' '}
                {horaCorta(fecha)}
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="icon-box tone-info h-11 w-11 rounded-xl">
              <Clock className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <dt className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-subtle">Cita</dt>
              <dd className="text-[15px] font-semibold">
                {CITA.nombre} · {CITA.duracionMin} min
              </dd>
            </div>
          </div>
          <div className="flex gap-3 sm:col-span-2">
            <span className="icon-box tone-info h-11 w-11 rounded-xl">
              <MapPin className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <dt className="text-[12.5px] font-semibold uppercase tracking-[0.04em] text-subtle">Dónde</dt>
              <dd className="text-[15px] font-semibold">
                {appointment.clinic.name} · {appointment.clinic.address}
              </dd>
            </div>
          </div>
        </dl>

        {aviso && (
          <p role="status" className="mt-6 flex items-start gap-2 rounded-[10px] bg-ok-bg px-4 py-3 text-sm text-ok">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
            {aviso}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-6 flex items-start gap-2 rounded-[10px] bg-bad-bg px-4 py-3 text-sm text-bad">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
            {error}
          </p>
        )}

        {!moviendo && !cancelando && (
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {estado === 'PENDIENTE' && !porReagendar && (
              <button type="button" onClick={() => void confirmar()} disabled={ocupado !== null} className="btn-primary sm:flex-1">
                {ocupado === 'confirmar' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />}
                Confirmar que asistiré
              </button>
            )}
            {puedeMover && (
              <button type="button" onClick={() => setMoviendo(true)} className="btn-outline sm:flex-1">
                <CalendarClock className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                Cambiar la hora
              </button>
            )}
            {viva && (
              <button type="button" onClick={() => setCancelando(true)} className="btn sm:flex-1 border-line bg-surface text-bad hover:border-bad/40 hover:bg-bad-bg">
                <XCircle className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                Cancelar la cita
              </button>
            )}
            {!viva && !porReagendar && (
              <Link href="/reservar" className="btn-primary sm:flex-1">
                Reservar otra cita
              </Link>
            )}
          </div>
        )}

        {cancelando && (
          <div className="mt-7 rounded-xl border border-line bg-cream p-4">
            <label htmlFor="motivo" className="field-label">
              ¿Nos cuenta por qué? <span className="font-normal text-muted">(opcional)</span>
            </label>
            <textarea id="motivo" rows={2} maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="field resize-none" />
            <p className="mt-2 text-[13px] text-muted">Si lo que pasa es que ese horario no le sirve, puede cambiar la hora en vez de cancelar.</p>
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <button type="button" onClick={() => void cancelar()} disabled={ocupado !== null} className="btn sm:flex-1 bg-bad text-white hover:bg-bad/90">
                {ocupado === 'cancelar' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Sí, cancelar
              </button>
              <button type="button" onClick={() => setCancelando(false)} className="btn-outline sm:flex-1">
                No, mantenerla
              </button>
            </div>
          </div>
        )}
      </div>

      {moviendo && (
        <div className="rounded-[22px] border border-line bg-surface p-5 sm:p-7">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 className="text-[1.4rem]">Elija la nueva hora</h2>
            {!porReagendar && (
              <button type="button" onClick={() => { setMoviendo(false); setNueva(null); }} className="btn-text">
                Cancelar
              </button>
            )}
          </div>
          <SelectorDeHorario
            fuente={`/api/public/bookings/${token}/horarios`}
            elegido={nueva?.slot.startsAt ?? null}
            onElegir={elegir}
          />
          <button type="button" onClick={() => void mover()} disabled={!nueva || ocupado !== null} className="btn-primary mt-6 w-full">
            {ocupado === 'mover' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CalendarCheck className="h-4 w-4" strokeWidth={1.8} aria-hidden />}
            {nueva ? (
              <span className="first-letter:uppercase">
                Pasar mi cita al {diaLargoDeClave(nueva.dia)} · {horaCorta(nueva.slot.startsAt)}
              </span>
            ) : (
              'Elija un horario'
            )}
          </button>
        </div>
      )}

      <p className="text-center text-sm text-muted">
        ¿Prefiere hablar con nosotros?{' '}
        <a href={escribir} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-600 underline">
          <MessageCircle className="h-4 w-4" strokeWidth={1.8} aria-hidden />
          Escríbanos por WhatsApp
        </a>
      </p>
    </div>
  );
}
