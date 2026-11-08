'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarCheck, Loader2, LockKeyhole, MessageCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { Reveal } from '@/components/ui/Reveal';
import { api } from '@/lib/apiClient';
import { CITA } from '@/lib/agenda';
import { horaCorta } from '@/lib/format';
import type { AvailabilityResponse, DayAvailability, TimeSlot } from '@/lib/types';

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function partesDeClave(clave: string) {
  const fecha = new Date(`${clave}T12:00:00Z`);
  return { semana: DIAS_CORTOS[fecha.getUTCDay()], dia: fecha.getUTCDate() };
}

function diaLargo(clave: string) {
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(`${clave}T12:00:00Z`),
  );
}

/**
 * La reserva de la portada: día y hora en la misma pantalla.
 *
 * Es el primer paso de la reserva, no una maqueta: los días y las horas son
 * los libres de verdad. Al pulsar «Continuar» se pasa a /reservar con la hora
 * ya elegida, donde solo quedan el nombre y el celular.
 *
 * Solo se ofrecen los próximos cinco días con algo libre. Más que eso en la
 * portada abruma; quien busca una fecha lejana la encuentra en /reservar.
 */
export function ReservaRapida() {
  const router = useRouter();
  const [dias, setDias] = useState<DayAvailability[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [diaElegido, setDiaElegido] = useState<string | null>(null);
  const [hora, setHora] = useState<TimeSlot | null>(null);
  const [yendo, setYendo] = useState(false);

  useEffect(() => {
    const control = new AbortController();
    api
      .get<AvailabilityResponse>('/api/public/availability?days=21', { signal: control.signal, auth: false })
      .then((r) => {
        const conLibres = r.days.filter((d) => d.availableCount > 0).slice(0, 5);
        setDias(conLibres);
        setDiaElegido(conLibres[0]?.date ?? null);
      })
      .catch(() => {
        if (!control.signal.aborted) setFallo(true);
      });
    return () => control.abort();
  }, []);

  const delDia = useMemo(
    () => (dias ?? []).find((d) => d.date === diaElegido)?.slots.filter((s) => s.available || s.motivo === 'ocupado') ?? [],
    [dias, diaElegido],
  );

  function continuar() {
    if (!hora) return;
    setYendo(true);
    router.push(`/reservar?inicio=${encodeURIComponent(hora.startsAt)}`);
  }

  return (
    <section
      id="reserva"
      aria-labelledby="reserva-sec-titulo"
      className="relative overflow-hidden py-[clamp(72px,9vw,120px)] [background:radial-gradient(640px_420px_at_85%_40%,rgb(var(--accent-400)/0.16),transparent_65%),rgb(var(--cream))]"
    >
      <div className="shell grid grid-cols-[minmax(0,1fr)] items-center gap-[clamp(36px,6vw,96px)] lg:grid-cols-2">
        <Reveal>
          <span className="eyebrow">Reserva en línea</span>
          <h2 id="reserva-sec-titulo" className="mt-3.5 text-[clamp(2rem,3.4vw,2.85rem)] leading-[1.12]">
            Elija su horario en <em className="font-normal italic text-brand-600">menos de un minuto</em>
          </h2>
          <p className="lead mt-4 max-w-[500px]">
            Vea los horarios que de verdad están libres y reserve sin llamar. Si después necesita
            cambiarla, lo hace desde el enlace que le llega.
          </p>
          <ul className="mt-8 grid gap-[18px]">
            {[
              { Icono: MessageCircle, t: 'Confirmación inmediata', d: 'Por WhatsApp, con la hora y la dirección exactas.' },
              { Icono: RefreshCw, t: 'Cambios sin complicaciones', d: 'Cambie la hora o cancele desde el mismo enlace.' },
              { Icono: ShieldCheck, t: 'Sus datos protegidos', d: 'Solo los ve el equipo del centro.' },
            ].map(({ Icono, t, d }) => (
              <li key={t} className="flex gap-3.5">
                <span className="icon-box h-11 w-11 rounded-xl bg-surface text-brand-700 shadow-[inset_0_0_0_1px_rgb(var(--line)),0_6px_14px_-10px_rgb(var(--ink)/0.5)]">
                  <Icono className="h-5 w-5" strokeWidth={1.8} aria-hidden />
                </span>
                <div>
                  <b className="block text-[15.5px]">{t}</b>
                  <span className="mt-0.5 block text-[14.5px] text-muted">{d}</span>
                </div>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={90}>
          <div className="relative grid justify-items-center">
            <span
              aria-hidden
              className="absolute -bottom-7 -top-7 w-[92%] rounded-t-full rounded-b-[28px] bg-gradient-to-b from-accent-400/[0.22] to-accent-400/[0.04] sm:w-[78%]"
            />
            <div
              id="reservar"
              className="relative z-[1] w-full max-w-[460px] rounded-[22px] border border-line bg-surface p-[18px] shadow-[0_2px_4px_rgb(var(--ink)/0.04),0_36px_64px_-32px_rgb(var(--ink)/0.5)] sm:p-[26px]"
            >
              <div className="mb-4 flex items-baseline justify-between gap-3">
                <h3 className="text-[1.35rem]">Reserve su cita</h3>
                <span className="text-[12.5px] font-semibold text-subtle">Paso 1 de 2</span>
              </div>

              {fallo ? (
                <p className="rounded-[10px] bg-warn-bg px-4 py-3 text-sm text-warn">
                  No pudimos cargar los horarios. Pruebe en la página de reservas o escríbanos por WhatsApp.
                </p>
              ) : !dias ? (
                <p className="flex items-center gap-2 py-10 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Buscando horarios libres…
                </p>
              ) : dias.length === 0 ? (
                <p className="rounded-[10px] bg-cream px-4 py-4 text-sm text-muted">
                  En las próximas semanas no quedan horarios libres. Escríbanos por WhatsApp y le avisamos
                  apenas se abra uno.
                </p>
              ) : (
                <>
                  <div className="mb-3.5 grid gap-2" role="group" aria-labelledby="rapida-fecha">
                    <span id="rapida-fecha" className="text-[13.5px] font-semibold">
                      Fecha
                    </span>
                    <div className="grid grid-cols-5 gap-[7px]">
                      {dias.map((dia) => {
                        const { semana, dia: numero } = partesDeClave(dia.date);
                        const elegido = dia.date === diaElegido;
                        return (
                          <button
                            key={dia.date}
                            type="button"
                            aria-pressed={elegido}
                            aria-label={diaLargo(dia.date)}
                            onClick={() => {
                              setDiaElegido(dia.date);
                              setHora(null);
                            }}
                            className={`grid min-h-14 justify-items-center gap-px rounded-[10px] border px-0.5 py-2 transition-[border-color,background-color,transform] duration-200 ${
                              elegido
                                ? 'border-brand-700 bg-brand-700 text-white shadow-[0_8px_16px_-10px_rgb(var(--brand-700)/0.8)]'
                                : 'border-line bg-surface hover:-translate-y-px hover:border-line-strong'
                            }`}
                          >
                            <small className={`text-xs font-medium capitalize ${elegido ? 'text-white/80' : 'text-subtle'}`}>{semana}</small>
                            <b className="text-[17px] font-semibold">{numero}</b>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mb-4 grid gap-2" role="group" aria-labelledby="rapida-hora">
                    <span id="rapida-hora" className="text-[13.5px] font-semibold">
                      Hora disponible · {CITA.duracionMin} min
                    </span>
                    <div className="grid grid-cols-3 gap-[7px] sm:grid-cols-4">
                      {delDia.map((slot) => (
                        <button
                          key={slot.startsAt}
                          type="button"
                          disabled={!slot.available}
                          aria-pressed={hora?.startsAt === slot.startsAt}
                          aria-label={slot.available ? horaCorta(slot.startsAt) : `${horaCorta(slot.startsAt)}, no disponible`}
                          onClick={() => setHora(slot)}
                          className={`h-10 whitespace-nowrap rounded-[9px] border text-[13.5px] font-semibold transition-colors ${
                            hora?.startsAt === slot.startsAt
                              ? 'border-brand-600 bg-brand-100 text-brand-700'
                              : slot.available
                                ? 'border-line bg-surface hover:border-line-strong'
                                : 'cursor-not-allowed border-[#F3F4F6] bg-[#F3F4F6] text-[#A3ACB9] line-through'
                          }`}
                        >
                          {horaCorta(slot.startsAt)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div aria-live="polite" className="mb-3.5 mt-0.5 flex items-center gap-2.5 rounded-[10px] bg-brand-50 px-3.5 py-3 text-sm font-semibold text-brand-700">
                    <CalendarCheck className="h-[18px] w-[18px] flex-none" strokeWidth={1.8} aria-hidden />
                    <span className="first-letter:uppercase">
                      {hora && diaElegido
                        ? `${CITA.nombre} · ${diaLargo(diaElegido)} · ${horaCorta(hora.startsAt)}`
                        : 'Elija una hora para continuar'}
                    </span>
                  </div>

                  <button type="button" onClick={continuar} disabled={!hora || yendo} className="btn-primary w-full">
                    {yendo ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                    Continuar
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                  </button>
                </>
              )}

              <p className="mt-3 flex items-center gap-2 text-[13px] text-subtle">
                <LockKeyhole className="h-4 w-4 text-ok" strokeWidth={1.8} aria-hidden />
                Recibirá la confirmación por WhatsApp.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
