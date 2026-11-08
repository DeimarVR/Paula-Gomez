'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { api } from '@/lib/apiClient';
import { hoyEnClinica } from '@/lib/format';
import { SelectorHueco } from '@/components/admin/SelectorHueco';
import { fechaEnPalabras } from '@/lib/mensajesCita';
import type { AppointmentListItem } from '@/lib/types';

/**
 * Mover una cita a otro día y hora, desde el panel.
 *
 * El paciente ya tenía cómo reprogramar —el enlace que recibe al reservar—,
 * pero en la práctica casi nunca lo usa: escribe por WhatsApp «¿me la pueden
 * pasar al jueves?». Sin este botón, la única salida era cancelar y volver a
 * crear la cita, que cambia el enlace del paciente, pierde el evento del
 * calendario y deja el historial contando dos citas donde hubo una.
 *
 * Los horarios salen de la agenda real y los ocupados se ven pero no se pueden
 * elegir; la hora que la cita ocupa ahora sale libre, para poder devolverla a
 * su sitio. La hora que deja se ofrece sola a quienes tienen cita después. Es lo que permite decirle al paciente «el jueves a las 3 no puedo,
 * ¿a las 4?» mientras se está hablando con él, en vez de descubrir el choque
 * al guardar. La grilla es la misma de Nueva cita: agendar y mover una cita se
 * hacen con el mismo control, para no tener que aprender dos.
 */

export function ReagendarCita({
  cita,
  onCerrar,
  onHecho,
}: {
  cita: AppointmentListItem;
  onCerrar: () => void;
  onHecho: () => void;
}) {
  // Empieza en el día de la cita: lo normal es moverla unas horas, no semanas.
  const [fecha, setFecha] = useState(() => {
    const delDia = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(cita.startsAt));
    return delDia < hoyEnClinica() ? hoyEnClinica() : delDia;
  });
  /** "18:30", para pintar cuál está elegida. */
  const [hora, setHora] = useState('');
  /** El instante que mandó el servidor, que es lo que se guarda. */
  const [elegido, setElegido] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cambiar de día invalida la hora que estuviera elegida: ese hueco era del
  // día anterior.
  useEffect(() => {
    setHora('');
    setElegido(null);
  }, [fecha]);

  async function guardar() {
    if (!elegido) return;

    setGuardando(true);
    setError(null);
    try {
      await api.patch(`/api/appointments/${cita.id}/reschedule`, { startsAt: elegido });
      onHecho();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No pudimos mover la cita');
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/50 p-4 backdrop-blur-sm sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reagendar-titulo"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-lift sm:p-7"
      >
        <h2 id="reagendar-titulo" className="text-2xl">Reagendar la cita</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted">{cita.contactName}</p>
        <p className="mt-3 rounded-[10px] bg-cream px-4 py-3 text-sm">
          <span className="text-muted">Ahora está el </span>
          {fechaEnPalabras(cita.startsAt, 'America/Bogota')}.
        </p>

        <div className="mt-6">
          <label htmlFor="reagendar-fecha" className="field-label">
            Nuevo día
          </label>
          <input
            id="reagendar-fecha"
            type="date"
            value={fecha}
            min={hoyEnClinica()}
            onChange={(evento) => setFecha(evento.target.value)}
            className="field"
          />
        </div>

        <div className="mt-5">
          <span className="field-label">Nueva hora</span>
          <SelectorHueco
            fecha={fecha}
            excluirCitaId={cita.id}
            valor={hora}
            onElegir={(nuevaHora, startsAt) => {
              setHora(nuevaHora);
              setElegido(startsAt);
            }}
          />
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-[10px] bg-bad-bg px-4 py-3 text-sm text-bad">{error}</p>
        )}

        {elegido && (
          <p className="ayuda mt-5">
            <span>
              Queda el <strong>{fechaEnPalabras(elegido, 'America/Bogota')}</strong>. El evento del
              calendario se mueve solo, el paciente recibe la nueva fecha y su enlace sigue
              sirviendo.
            </span>
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={!elegido || guardando}
            className="btn-primary sm:flex-1"
          >
            {guardando ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <CalendarClock className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            )}
            Mover la cita
          </button>
          <button type="button" onClick={onCerrar} className="btn-outline sm:flex-1">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
