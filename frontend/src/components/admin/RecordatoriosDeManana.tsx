'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BellRing,
  CalendarCheck,
  Check,
  Hourglass,
  Loader2,
  MessageCircle,
  Undo2,
} from 'lucide-react';
import { api } from '@/lib/apiClient';
import { buildWhatsAppLink, formatPhone, horaCorta } from '@/lib/format';
import { SITE } from '@/lib/config';
import {
  horaEnPalabras,
  textoRecordatorioCita,
  whatsappEnPalabras,
} from '@/lib/mensajesCita';

/**
 * Los recordatorios de mañana, uno por uno, con el mensaje ya escrito.
 *
 * El sistema TIENE un envío automático: una tarea corre cada mañana y le manda
 * el recordatorio a quien tenga cita al día siguiente. Pero depende de la API
 * de WhatsApp, que exige plantillas aprobadas por Meta y un número propio
 * registrado. Mientras eso no esté, la tarea corre, no consigue enviar nada y
 * no deja rastro: el paciente no recibe nada y en el centro nadie se entera.
 *
 * Esta pantalla es el puente: un botón por paciente, WhatsApp abre con el texto
 * completo y solo queda darle a enviar. Al tocarlo se marca en la misma casilla
 * que usa la tarea automática, así que el día que WhatsApp quede configurado
 * las dos vías se entienden en vez de duplicar mensajes.
 *
 * Es UN mensaje, no dos. Antes eran dos —uno preguntaba si venía y otro, cuando
 * contestaba, traía la dirección—, y eso obligaba a abrir WhatsApp dos veces
 * por paciente. Ahora la dirección va en el mismo mensaje y lo único que queda
 * después es apuntar la respuesta.
 *
 * Por eso el botón grande cambia de trabajo según el estado, y solo es verde
 * —el verde de WhatsApp— cuando de verdad abre WhatsApp. El de «Confirmó» no
 * manda nada: guarda la cita como CONFIRMADA. Si eso hubiera que hacerlo aparte
 * en Citas, a la tercera cita del día ya nadie lo haría y la agenda diría que
 * nadie confirmó nunca.
 */

interface CitaRecordatorio {
  id: string;
  contactName: string;
  contactPhone: string;
  startsAt: string;
  status: string;
  whatsappReminderSentAt: string | null;
  service: { id: string; name: string };
  patient: { id: string; fullName: string } | null;
}

/** La hora sola, que es lo que se busca al mirar la lista de mañana. */
function soloHora(iso: string): string {
  return horaCorta(iso);
}

/** «2026-09-09» -> «miércoles 9 de septiembre». */
function diaEnPalabras(clave: string): string {
  const [anio, mes, dia] = clave.split('-').map(Number);
  // Mediodía UTC: da igual el desfase, nunca cae en el día de al lado.
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, 12));
  return new Intl.DateTimeFormat('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(fecha);
}

/** El único mensaje de la víspera: recuerda, dice dónde es y pide respuesta. */
function textoRecordatorio(cita: CitaRecordatorio): string {
  return textoRecordatorioCita({
    centro: SITE.nombreEnMensajes,
    // La zona horaria es la de la clínica, no la del navegador: alguien
    // revisando esto desde otro país no puede hacer que el mensaje mienta.
    hora: horaEnPalabras(cita.startsAt, 'America/Bogota'),
    sede: SITE.addressFallback,
    whatsapp: whatsappEnPalabras(SITE.whatsappFallback),
  });
}

export function RecordatoriosDeManana({ onCambio }: { onCambio?: () => void }) {
  const [items, setItems] = useState<CitaRecordatorio[]>([]);
  const [fecha, setFecha] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await api.get<{ items: CitaRecordatorio[]; fecha: string }>(
        '/api/appointments/recordatorios',
      );
      // `?? []` no es paranoia: si la ruta falla al compilar o cambia de
      // forma, la respuesta llega sin `items` y un `.filter` sobre undefined
      // tumba la pantalla entera con un error rojo que no explica nada.
      setItems(datos?.items ?? []);
      setFecha(datos?.fecha ?? null);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos cargar las citas de mañana');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function marcar(cita: CitaRecordatorio, enviado: boolean) {
    setTrabajando(cita.id);
    try {
      await api.patch(`/api/appointments/${cita.id}/recordatorio`, { enviado });
      await cargar();
      onCambio?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos marcar el recordatorio');
    } finally {
      setTrabajando(null);
    }
  }

  /**
   * El paciente contestó que sí. Esto no manda nada: solo apunta la respuesta.
   * El mensaje ya se le mandó, y mandarle otro para decirle lo que él acaba de
   * decirnos es hacerle perder el tiempo a los dos.
   */
  async function confirmar(cita: CitaRecordatorio) {
    setTrabajando(cita.id);
    try {
      await api.patch(`/api/appointments/${cita.id}/status`, { status: 'CONFIRMADA' });
      await cargar();
      onCambio?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos confirmar la cita');
    } finally {
      setTrabajando(null);
    }
  }

  /**
   * Tres grupos, en el orden en que se trabaja: a quién hay que avisar, de
   * quién se espera respuesta, y quién ya confirmó. Sin este orden hay que
   * leer la lista entera para saber qué falta.
   */
  const pendientes = items.filter((c) => !c.whatsappReminderSentAt);
  const esperando = items.filter((c) => c.whatsappReminderSentAt && c.status !== 'CONFIRMADA');
  const confirmadas = items.filter((c) => c.whatsappReminderSentAt && c.status === 'CONFIRMADA');

  return (
    <div>
      <div className="rounded-2xl bg-brand-50 px-5 py-4">
        <p className="text-sm leading-relaxed text-brand-900">
          Citas de <strong>mañana{fecha ? `, ${diaEnPalabras(fecha)}` : ''}</strong>. Un solo
          mensaje por paciente: recuerda la cita, dice dónde es y le pide que confirme. WhatsApp
          abre con el texto ya escrito. Cuando conteste, se marca aquí y listo.
        </p>
      </div>

      {error && (
        <p className="mt-6 rounded-2xl bg-bad-bg px-5 py-4 text-sm text-bad">{error}</p>
      )}

      {cargando && (
        <p className="mt-8 flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Cargando…
        </p>
      )}

      {!cargando && items.length === 0 && (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-surface px-8 py-16 text-center">
          <CalendarCheck className="mx-auto h-8 w-8 text-brand-300" strokeWidth={1.5} aria-hidden />
          <p className="mt-4 font-display text-lg">Mañana no hay citas</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
            Cuando alguien agende para mañana, aparecerá aquí para avisarle.
          </p>
        </div>
      )}

      {!cargando && items.length > 0 && pendientes.length === 0 && esperando.length === 0 && (
        <p className="mt-6 flex items-center gap-2 rounded-2xl bg-brand-700/10 px-5 py-4 text-sm font-medium text-brand-900">
          <Check className="h-4 w-4" strokeWidth={2.4} aria-hidden />
          {items.length === 1
            ? 'El paciente de mañana ya confirmó.'
            : `Los ${items.length} pacientes de mañana ya confirmaron.`}
        </p>
      )}

      {!cargando && esperando.length > 0 && (
        <p className="mt-6 flex items-center gap-2 rounded-2xl bg-warn-bg px-5 py-4 text-sm text-brand-900">
          <Hourglass className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
          {esperando.length === 1
            ? 'Falta que 1 paciente conteste al recordatorio.'
            : `Faltan ${esperando.length} pacientes por contestar al recordatorio.`}
        </p>
      )}

      <ul className="mt-6 space-y-4">
        {[...pendientes, ...esperando, ...confirmadas].map((cita) => {
          const avisado = Boolean(cita.whatsappReminderSentAt);
          const confirmada = cita.status === 'CONFIRMADA';
          /**
           * Tres estados y una sola acción visible en cada uno. La del día es
           * siempre el botón verde grande: pedir que confirme, o —cuando ya
           * contestó— mandarle la confirmación con la dirección. Lo demás va en
           * secundario para que no compita con ella.
           */
          const ocupado = trabajando === cita.id;

          return (
            <li
              key={cita.id}
              className={`rounded-2xl border p-6 ${
                confirmada
                  ? 'border-line bg-surface/60'
                  : avisado
                    ? 'border-warn/30 bg-surface'
                    : 'border-brand-200 bg-surface'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg">
                    {cita.contactName}
                    {confirmada ? (
                      <span className="ml-2 rounded-full bg-brand-700/10 px-2.5 py-0.5 text-[0.65rem] font-normal text-brand-900">
                        Confirmada
                      </span>
                    ) : (
                      avisado && (
                        <span className="ml-2 rounded-full bg-warn-bg px-2.5 py-0.5 text-[0.65rem] font-normal text-warn">
                          Esperando respuesta
                        </span>
                      )
                    )}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted">
                    {cita.service.name} · {formatPhone(cita.contactPhone)}
                  </p>
                </div>
                <span className="shrink-0 rounded-xl bg-cream px-3 py-1.5 text-sm font-semibold tabular-nums text-brand-900">
                  {soloHora(cita.startsAt)}
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                {!avisado && (
                  <>
                    <a
                      href={buildWhatsAppLink(cita.contactPhone, textoRecordatorio(cita))}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void marcar(cita, true)}
                      className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-6 text-base font-semibold text-white transition-colors hover:bg-[#1faa53]"
                    >
                      <MessageCircle className="h-5 w-5" strokeWidth={2} aria-hidden />
                      Pedirle que confirme
                    </a>
                    <button
                      type="button"
                      onClick={() => void marcar(cita, true)}
                      disabled={ocupado}
                      title="Si ya le escribiste por otro medio"
                      className="btn-outline min-h-12 px-4 text-sm"
                    >
                      {ocupado ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
                      )}
                      Ya le escribí
                    </button>
                  </>
                )}

                {avisado && !confirmada && (
                  <>
                    {/*
                      Este botón NO manda nada: apunta que el paciente contestó
                      que sí. El mensaje con la dirección ya se le mandó, y ese
                      era el segundo envío que había que hacer por cada
                      paciente. Por eso tampoco es verde: el verde de WhatsApp
                      está reservado para lo que de verdad abre WhatsApp.
                    */}
                    <button
                      type="button"
                      onClick={() => void confirmar(cita)}
                      disabled={ocupado}
                      className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-700 px-6 text-base font-semibold text-white transition-colors hover:bg-brand-800 disabled:pointer-events-none disabled:opacity-60"
                    >
                      {ocupado ? (
                        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      ) : (
                        <Check className="h-5 w-5" strokeWidth={2.4} aria-hidden />
                      )}
                      Confirmó que viene
                    </button>
                    <a
                      href={buildWhatsAppLink(cita.contactPhone, textoRecordatorio(cita))}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Si no ha contestado"
                      className="btn-outline min-h-12 px-4 text-sm"
                    >
                      <BellRing className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                      Insistir
                    </a>
                    <button
                      type="button"
                      onClick={() => void marcar(cita, false)}
                      disabled={ocupado}
                      title="Volver a dejarla como no avisada"
                      aria-label={`Deshacer el aviso de ${cita.contactName}`}
                      className="btn-outline min-h-12 px-4 text-sm"
                    >
                      {ocupado ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Undo2 className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                      )}
                      No lo mandé
                    </button>
                  </>
                )}

                {confirmada && (
                  <a
                    href={buildWhatsAppLink(cita.contactPhone, textoRecordatorio(cita))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-line px-6 text-base font-semibold text-ink/70 transition-colors hover:bg-brand-50"
                  >
                    <MessageCircle className="h-5 w-5" strokeWidth={2} aria-hidden />
                    Volver a mandarle el mensaje
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {!cargando && items.length > 0 && (
        <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-muted">
          <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden />
          El sistema también intenta mandarlos solo cada mañana, pero eso necesita la API de
          WhatsApp conectada con plantillas aprobadas. Hasta entonces, este botón es el envío.
        </p>
      )}
    </div>
  );
}
