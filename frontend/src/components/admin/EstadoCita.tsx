import { CalendarX, Check, CheckCheck, Clock, UserX, X } from 'lucide-react';
import type { AppointmentStatus } from '@/lib/types';

/**
 * El estado de una cita como insignia: color, icono y palabra.
 *
 * Las tres cosas a la vez, nunca solo el color: quien no distingue el verde
 * del rojo tiene que poder leer la agenda igual. Y en un solo sitio, para que
 * «Por confirmar» no se llame «Pendiente» en otra pantalla.
 */
const ESTILOS: Record<
  AppointmentStatus | 'DIA_CERRADO',
  { clase: string; texto: string; Icono: typeof Check }
> = {
  PENDIENTE: { clase: 'badge-warn', texto: 'Por confirmar', Icono: Clock },
  CONFIRMADA: { clase: 'badge-ok', texto: 'Confirmada', Icono: Check },
  COMPLETADA: { clase: 'badge-neutral', texto: 'Atendida', Icono: CheckCheck },
  CANCELADA: { clase: 'badge-bad', texto: 'Cancelada', Icono: X },
  NO_ASISTIO: { clase: 'badge-bad', texto: 'No asistió', Icono: UserX },
  DIA_CERRADO: { clase: 'badge-warn', texto: 'Día cerrado · por reagendar', Icono: CalendarX },
};

export const TEXTO_ESTADO: Record<AppointmentStatus, string> = {
  PENDIENTE: ESTILOS.PENDIENTE.texto,
  CONFIRMADA: ESTILOS.CONFIRMADA.texto,
  COMPLETADA: ESTILOS.COMPLETADA.texto,
  CANCELADA: ESTILOS.CANCELADA.texto,
  NO_ASISTIO: ESTILOS.NO_ASISTIO.texto,
};

export function EstadoCita({
  estado,
  porReagendar = false,
}: {
  estado: AppointmentStatus;
  /** Cancelada al cerrar el día: espera que el paciente elija otra hora. */
  porReagendar?: boolean;
}) {
  const { clase, texto, Icono } = ESTILOS[estado === 'CANCELADA' && porReagendar ? 'DIA_CERRADO' : estado];
  return (
    <span className={clase}>
      <Icono strokeWidth={2.2} aria-hidden />
      {texto}
    </span>
  );
}
