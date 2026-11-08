'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/apiClient';

/**
 * La hora del próximo control, sacada de la agenda real.
 *
 * Era un `<input type="time">` a pelo: se escribía cualquier hora y el choque
 * con otra cita solo aparecía al guardar, en forma de aviso, con el paciente ya
 * de pie en la puerta. Ahora se ofrecen los huecos del día y los ocupados salen
 * en la lista pero no se pueden elegir —igual que en la reserva pública—, que
 * es lo que permite decir «a las diez no puedo, ¿a las once?» en el momento.
 *
 * Hace falta el tratamiento antes que la hora, y no es un capricho del
 * formulario: la duración sale del tratamiento y sin ella no se sabe dónde
 * empieza el hueco siguiente.
 */

interface Hueco {
  time: string;
  available: boolean;
  motivo?: 'ocupado' | 'pausa' | 'muy-pronto' | 'muy-lejos';
}

interface Props {
  fecha: string;
  serviceId: string | null;
  valor: string | null;
  onCambiar: (hora: string | null) => void;
  etiqueta: string;
  className: string;
}

const MOTIVO: Record<string, string> = {
  ocupado: 'ocupado',
  pausa: 'almuerzo',
  'muy-pronto': 'muy pronto',
  'muy-lejos': 'muy lejos',
};

export function SelectorHoraControl({
  fecha,
  serviceId,
  valor,
  onCambiar,
  etiqueta,
  className,
}: Props) {
  const [huecos, setHuecos] = useState<Hueco[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    if (!fecha || !serviceId) {
      setHuecos(null);
      return;
    }

    const control = new AbortController();
    setCargando(true);

    void (async () => {
      try {
        const datos = await api.get<{
          days: Array<{ date: string; open: boolean; slots: Hueco[] }>;
        }>(
          `/api/availability?serviceId=${encodeURIComponent(serviceId)}&from=${fecha}&days=1`,
          { signal: control.signal },
        );
        const dia = datos.days[0];
        setCerrado(!dia?.open);
        setHuecos(dia?.slots ?? []);
      } catch {
        // Sin agenda se sigue pudiendo escribir la hora a mano, más abajo.
        setHuecos(null);
      } finally {
        setCargando(false);
      }
    })();

    return () => control.abort();
  }, [fecha, serviceId]);

  // Sin tratamiento no hay duración, y sin duración no hay huecos que calcular.
  if (!serviceId) {
    return (
      <input
        type="time"
        value={valor ?? ''}
        onChange={(evento) => onCambiar(evento.target.value || null)}
        aria-label={etiqueta}
        title="Elige el tratamiento para ver los horarios libres"
        className={className}
      />
    );
  }

  if (cargando && !huecos) {
    return <p className={`${className} text-brand-700/60`}>Buscando horarios…</p>;
  }

  if (!huecos) {
    return (
      <input
        type="time"
        value={valor ?? ''}
        onChange={(evento) => onCambiar(evento.target.value || null)}
        aria-label={etiqueta}
        className={className}
      />
    );
  }

  if (cerrado || huecos.length === 0) {
    return <p className={`${className} text-bad`}>Ese día no se atiende</p>;
  }

  /**
   * La hora ya guardada puede no estar entre los huecos: la ficha se abrió otro
   * día, o la agendaron a una hora fuera del horario normal. Se añade para no
   * borrarla sin avisar solo por abrir la ficha.
   */
  const fuera = valor && !huecos.some((hueco) => hueco.time === valor);

  return (
    <select
      value={valor ?? ''}
      onChange={(evento) => onCambiar(evento.target.value || null)}
      aria-label={etiqueta}
      className={className}
    >
      <option value="">Hora…</option>
      {fuera && <option value={valor ?? ''}>{valor} (fuera de horario)</option>}
      {huecos.map((hueco) => (
        <option key={hueco.time} value={hueco.time} disabled={!hueco.available}>
          {hueco.time}
          {!hueco.available && ` — ${MOTIVO[hueco.motivo ?? ''] ?? 'no disponible'}`}
        </option>
      ))}
    </select>
  );
}
