'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarCheck, Check, Loader2, MessageCircle, TriangleAlert } from 'lucide-react';
import { ApiError, api } from '@/lib/apiClient';
import { CITA } from '@/lib/agenda';
import { horaCorta } from '@/lib/format';
import { SelectorDeHorario, diaLargoDeClave } from '@/components/booking/SelectorDeHorario';
import type { BookingResponse, TimeSlot } from '@/lib/types';

interface BookingWizardProps {
  whatsappLink: string;
  /** Hora ya elegida en la portada. */
  inicio?: string;
  /** Si viene de la página de un servicio, se anota como motivo. */
  interesadoEn?: string;
}

/**
 * Los campos que se pueden marcar en rojo, EN EL ORDEN en que aparecen. Con
 * varios errores el foco va al primero, que es el que se ve al subir la vista.
 */
const CAMPOS_EN_ORDEN = ['contactName', 'contactPhone', 'contactEmail', 'acceptsPolicy'] as const;
type Campo = (typeof CAMPOS_EN_ORDEN)[number];

/** Lo mismo que valida el servidor, para decirlo en el campo y al instante. */
function validar(form: { contactName: string; contactPhone: string; contactEmail: string; acceptsPolicy: boolean }) {
  const errores: Partial<Record<Campo, string>> = {};
  if (form.contactName.trim().length < 3) errores.contactName = 'Escriba su nombre completo.';

  const digitos = form.contactPhone.replace(/\D/g, '');
  if (digitos.length === 0) errores.contactPhone = 'Necesitamos un número para confirmarle la cita.';
  else if (digitos.length < 7) errores.contactPhone = 'Ese número está incompleto. Un celular en Colombia tiene 10 dígitos.';
  else if (digitos.length > 15) errores.contactPhone = 'Ese número tiene demasiados dígitos.';

  const correo = form.contactEmail.trim();
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo)) {
    errores.contactEmail = 'Ese correo no parece estar bien escrito.';
  }
  if (!form.acceptsPolicy) errores.acceptsPolicy = 'Necesitamos su autorización para poder agendar la cita.';
  return errores;
}

function enfocar(errores: Partial<Record<Campo, string>>) {
  const campo = CAMPOS_EN_ORDEN.find((n) => errores[n]);
  const elemento = campo ? document.getElementById(campo) : null;
  if (!elemento) return;
  elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
  elemento.focus({ preventScroll: true });
}

/**
 * La reserva en línea, en dos pasos.
 *
 * Ya no se elige tratamiento: hay un solo tipo de cita, la consulta de 75
 * minutos. Primero el día y la hora —de los que están libres de verdad—, y
 * después el nombre y el celular. Si alguien toma el mismo horario mientras
 * se llena el formulario, se vuelve al calendario con el motivo a la vista.
 */
export function BookingWizard({ whatsappLink, inicio, interesadoEn }: BookingWizardProps) {
  const [paso, setPaso] = useState<'horario' | 'datos' | 'listo'>('horario');
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** Sube para obligar al calendario a recargarse tras un choque. */
  const [vuelta, setVuelta] = useState(0);

  const [form, setForm] = useState({
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    message: interesadoEn ? `Me interesa: ${interesadoEn}` : '',
    acceptsPolicy: false,
    website: '', // trampa para bots
  });
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<BookingResponse | null>(null);

  const elegir = useCallback((elegido: TimeSlot, delDia: string) => {
    setSlot(elegido);
    setDia(delDia);
    setAviso(null);
  }, []);

  function cambiar<K extends keyof typeof form>(campo: K, valor: (typeof form)[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErrores((e) => {
      if (!(campo in e)) return e;
      const resto = { ...e };
      delete resto[campo as Campo];
      return resto;
    });
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!slot) return;
    const problemas = validar(form);
    if (Object.keys(problemas).length) {
      setErrores(problemas);
      setError(null);
      enfocar(problemas);
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const r = await api.post<BookingResponse>(
        '/api/public/bookings',
        {
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          contactEmail: form.contactEmail || undefined,
          message: form.message || undefined,
          startsAt: slot.startsAt,
          acceptsPolicy: form.acceptsPolicy,
          website: form.website,
        },
        { auth: false },
      );
      setResultado(r);
      setPaso('listo');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (caught) {
      const mensaje = caught instanceof Error ? caught.message : 'No pudimos agendar la cita';
      if (caught instanceof ApiError && caught.details) {
        const delServidor: Partial<Record<Campo, string>> = {};
        for (const d of caught.details) {
          if ((CAMPOS_EN_ORDEN as readonly string[]).includes(d.field)) delServidor[d.field as Campo] = d.message;
        }
        if (Object.keys(delServidor).length) {
          setErrores(delServidor);
          enfocar(delServidor);
        }
      }
      // Se ocupó mientras llenaba el formulario: de vuelta al calendario, con el motivo.
      if (caught instanceof ApiError && caught.status === 409) {
        setSlot(null);
        setAviso(mensaje);
        setVuelta((v) => v + 1);
        setPaso('horario');
      } else {
        setError(mensaje);
      }
    } finally {
      setEnviando(false);
    }
  }

  if (paso === 'listo' && resultado) {
    const numero = whatsappLink.replace(/^https?:\/\/wa\.me\//, '').split('?')[0];
    const texto = `Hola, soy ${form.contactName.trim()}. Confirmo mi cita del ${dia ? diaLargoDeClave(dia) : ''} a las ${horaCorta(resultado.appointment.startsAt)}.`;
    const enlaceConfirmar = `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;

    return (
      <div className="mx-auto max-w-xl text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-ok-bg text-ok">
          <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden />
        </span>
        <h2 className="mt-7 text-[clamp(2rem,4vw,2.6rem)]">Listo, {form.contactName.trim().split(/\s+/)[0]}</h2>
        <p className="lead mt-3">
          Su cita quedó agendada para el{' '}
          <strong className="font-semibold text-ink first-letter:lowercase">
            {dia ? diaLargoDeClave(dia) : ''} a las {horaCorta(resultado.appointment.startsAt)}
          </strong>
          .
        </p>

        <dl className="card mt-8 grid gap-3 p-6 text-left text-[15px]">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Cita</dt>
            <dd className="font-semibold">
              {CITA.nombre} · {CITA.duracionMin} min
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-line pt-3">
            <dt className="text-muted">Confirmación por WhatsApp</dt>
            <dd className="text-right font-semibold">
              {resultado.notifications.whatsappSent ? 'Enviada' : 'Confírmela usted abajo'}
            </dd>
          </div>
        </dl>

        <p className="mt-6 text-sm text-muted">Guarde este enlace para confirmar, cambiar la hora o cancelar:</p>
        <Link
          href={`/cita/${resultado.manageToken}`}
          className="mt-1.5 inline-block break-all text-sm font-semibold text-brand-600 underline underline-offset-4"
        >
          {resultado.manageUrl}
        </Link>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className="btn-outline">
            Volver al inicio
          </Link>
          {/* El mensaje sale del paciente hacia el centro: así queda un chat abierto por el que responder. */}
          <a href={enlaceConfirmar} target="_blank" rel="noopener noreferrer" className="btn-primary">
            <MessageCircle className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            Confirmar por WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1000px] items-start gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="rounded-[22px] border border-line bg-surface p-5 shadow-[0_2px_4px_rgb(var(--ink)/0.04),0_36px_64px_-32px_rgb(var(--ink)/0.45)] sm:p-7">
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <h2 className="text-[1.4rem]">{paso === 'horario' ? 'Elija día y hora' : 'Sus datos'}</h2>
          <span className="text-[12.5px] font-semibold text-subtle">Paso {paso === 'horario' ? 1 : 2} de 2</span>
        </div>

        {paso === 'horario' ? (
          <>
            {aviso && (
              <p role="alert" className="mb-5 flex items-start gap-2 rounded-[10px] bg-warn-bg px-4 py-3 text-sm text-warn">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
                {aviso}
              </p>
            )}
            <SelectorDeHorario
              key={vuelta}
              fuente="/api/public/availability"
              elegido={slot?.startsAt ?? null}
              onElegir={elegir}
              inicial={vuelta === 0 ? inicio : undefined}
            />
            <button
              type="button"
              disabled={!slot}
              onClick={() => setPaso('datos')}
              className="btn-primary mt-6 w-full"
            >
              Continuar
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            </button>
          </>
        ) : (
          <form onSubmit={enviar} noValidate className="grid gap-4">
            <div>
              <label htmlFor="contactName" className="field-label">
                Nombre completo
              </label>
              <input
                id="contactName"
                autoComplete="name"
                value={form.contactName}
                onChange={(e) => cambiar('contactName', e.target.value)}
                aria-invalid={Boolean(errores.contactName)}
                className={`field ${errores.contactName ? 'field-invalid' : ''}`}
              />
              {errores.contactName && <p className="field-error">{errores.contactName}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="contactPhone" className="field-label">
                  Celular (WhatsApp)
                </label>
                <input
                  id="contactPhone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.contactPhone}
                  onChange={(e) => cambiar('contactPhone', e.target.value)}
                  aria-invalid={Boolean(errores.contactPhone)}
                  className={`field ${errores.contactPhone ? 'field-invalid' : ''}`}
                  placeholder="300 123 4567"
                />
                {errores.contactPhone && <p className="field-error">{errores.contactPhone}</p>}
              </div>
              <div>
                <label htmlFor="contactEmail" className="field-label">
                  Correo <span className="font-normal text-muted">(opcional)</span>
                </label>
                <input
                  id="contactEmail"
                  type="email"
                  autoComplete="email"
                  value={form.contactEmail}
                  onChange={(e) => cambiar('contactEmail', e.target.value)}
                  aria-invalid={Boolean(errores.contactEmail)}
                  className={`field ${errores.contactEmail ? 'field-invalid' : ''}`}
                />
                {errores.contactEmail && <p className="field-error">{errores.contactEmail}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="message" className="field-label">
                Motivo de la consulta <span className="font-normal text-muted">(opcional)</span>
              </label>
              <textarea
                id="message"
                rows={3}
                maxLength={600}
                value={form.message}
                onChange={(e) => cambiar('message', e.target.value)}
                className="field resize-none"
                placeholder="Cuéntenos brevemente qué le gustaría revisar"
              />
            </div>

            {/* Trampa para bots: invisible para las personas. */}
            <div className="hidden" aria-hidden>
              <label htmlFor="website">No completar</label>
              <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => cambiar('website', e.target.value)} />
            </div>

            <label
              htmlFor="acceptsPolicy"
              className={`flex cursor-pointer items-start gap-3 rounded-[10px] border p-3.5 text-sm leading-relaxed ${
                errores.acceptsPolicy ? 'border-bad/40 bg-bad-bg/40' : 'border-line'
              }`}
            >
              <input
                id="acceptsPolicy"
                type="checkbox"
                checked={form.acceptsPolicy}
                onChange={(e) => cambiar('acceptsPolicy', e.target.checked)}
                aria-invalid={Boolean(errores.acceptsPolicy)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded accent-[rgb(var(--brand-700))]"
              />
              <span className="text-muted">
                Autorizo el tratamiento de mis datos para agendar y recordarme la cita, según la{' '}
                <Link href="/politica-de-datos" className="font-semibold text-brand-600 underline">
                  política de datos
                </Link>
                .
              </span>
            </label>
            {errores.acceptsPolicy && <p className="field-error -mt-2">{errores.acceptsPolicy}</p>}

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-[10px] bg-bad-bg px-4 py-3 text-sm text-bad">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
                {error}
              </p>
            )}

            <div className="mt-1 flex flex-col-reverse gap-3 sm:flex-row">
              <button type="button" onClick={() => setPaso('horario')} className="btn-outline sm:flex-1">
                <ArrowLeft className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                Cambiar hora
              </button>
              <button type="submit" disabled={enviando} className="btn-primary sm:flex-[1.4]">
                {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CalendarCheck className="h-4 w-4" strokeWidth={1.8} aria-hidden />}
                Agendar mi cita
              </button>
            </div>
          </form>
        )}
      </div>

      <aside className="grid gap-4 lg:sticky lg:top-28">
        <div className="rounded-[22px] bg-brand-50 p-6 text-brand-700">
          <p className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-brand-600">Su cita</p>
          <p className="mt-2 font-display text-[1.6rem] leading-tight text-ink">
            {CITA.nombre} con la especialista
          </p>
          <p className="mt-3 text-[15px] first-letter:uppercase">
            {slot && dia ? `${diaLargoDeClave(dia)} · ${horaCorta(slot.startsAt)}` : 'Elija un horario para verlo aquí'}
          </p>
          <p className="mt-1 text-sm text-brand-600">{CITA.duracionMin} minutos · una persona a la vez</p>
        </div>
        <ul className="grid gap-3 px-1 text-sm text-muted">
          <li className="flex gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={2.2} aria-hidden />
            Le llega la confirmación por WhatsApp, con la dirección.
          </li>
          <li className="flex gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={2.2} aria-hidden />
            Un día antes le recordamos la cita.
          </li>
          <li className="flex gap-2.5">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" strokeWidth={2.2} aria-hidden />
            Puede cambiar la hora o cancelar desde su enlace, sin llamar.
          </li>
        </ul>
      </aside>
    </div>
  );
}
