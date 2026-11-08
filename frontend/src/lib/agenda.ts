/**
 * Las reglas de la agenda, en un solo sitio.
 *
 * Las lee el servidor —que es el que decide— y también el navegador, para
 * dibujar la grilla y explicar por qué un horario no se puede tomar. Si cada
 * lado tuviera su copia, el día que cambie la duración la web ofrecería huecos
 * que el servidor rechaza.
 *
 * Nada de aquí lee la base de datos ni el entorno: son números y cuentas.
 */

/**
 * El único tipo de cita que existe.
 *
 * La especialista atiende una consulta de una hora y cuarto, a una persona por
 * vez. No hay que elegir tratamiento al reservar: lo que se haga se decide en
 * la consulta. El `slug` es el del servicio que respalda la cita en la base
 * —la tabla de citas exige uno— y no se publica en la web.
 */
export const CITA = {
  slug: 'consulta',
  nombre: 'Consulta',
  duracionMin: 75,
} as const;

/** Una sola persona dentro a la vez. Dos citas no pueden pisarse ni un minuto. */
export const PACIENTES_A_LA_VEZ = 1;

/** Desde la web no se reserva con menos de este margen. */
export const ANTICIPACION_MINIMA_MIN = 120;

/** Hasta cuántos días hacia adelante se puede reservar desde la web. */
export const DIAS_MAXIMOS = 60;

/**
 * El hueco que se libera se ofrece solo si falta al menos esto.
 *
 * Con menos tiempo nadie alcanza a reorganizarse para venir, y el mensaje
 * llega cuando ya no sirve: solo genera la sensación de una oportunidad
 * perdida.
 */
export const OFERTA_MARGEN_MIN = 180;

/**
 * A cuántas personas se les ofrece cada hueco.
 *
 * Las más cercanas primero. Cinco basta para que alguien conteste y evita
 * que media agenda reciba un mensaje por una sola hora: cada uno que llega
 * tarde ve «ya fue tomado», y eso desgasta.
 */
export const OFERTA_MAX_INVITADOS = 5;

/**
 * Hasta cuándo se puede aceptar un hueco ofrecido.
 *
 * El mismo margen que la reserva web: aceptar es reservar, solo que con
 * prioridad.
 */
export const OFERTA_CIERRE_MIN = ANTICIPACION_MINIMA_MIN;

export interface HorarioDelDia {
  /** "08:00" en hora local del centro. */
  open: string;
  close: string;
  breakStart?: string | null;
  breakEnd?: string | null;
}

/**
 * El horario que rige mientras no se configure otro en el panel.
 *
 * 0 es domingo. Es un punto de partida neutro: mañana y tarde entre semana con
 * una hora de almuerzo, el sábado solo la mañana y el domingo cerrado. Cuadra
 * con la cita de 75 minutos —cuatro por la mañana, tres por la tarde— para
 * que no sobren ratos muertos al final de cada tramo.
 */
export const HORARIO_POR_DEFECTO: Record<number, HorarioDelDia | undefined> = {
  1: { open: '08:00', close: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  2: { open: '08:00', close: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  3: { open: '08:00', close: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  4: { open: '08:00', close: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  5: { open: '08:00', close: '18:00', breakStart: '13:00', breakEnd: '14:00' },
  6: { open: '08:00', close: '13:00' },
};

export function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

export function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Los tramos en que se atiende: la jornada partida por el almuerzo.
 *
 * Una pausa que no cae dentro de la jornada —mal escrita, o puesta fuera de
 * hora— no parte nada. Mejor ignorarla que dejar el día sin un solo bloque.
 */
export function tramosDelDia(horario: HorarioDelDia): Array<[number, number]> {
  const apertura = aMinutos(horario.open);
  const cierre = aMinutos(horario.close);
  if (cierre <= apertura) return [];

  if (horario.breakStart && horario.breakEnd) {
    const inicio = aMinutos(horario.breakStart);
    const fin = aMinutos(horario.breakEnd);
    if (apertura < inicio && inicio < fin && fin < cierre) {
      return [
        [apertura, inicio],
        [fin, cierre],
      ];
    }
  }

  return [[apertura, cierre]];
}

/**
 * Las horas a las que empieza cada cita del día, en minutos desde medianoche.
 *
 * Las citas van seguidas desde la apertura: 8:00, 9:15, 10:30… y al volver del
 * almuerzo se arranca de nuevo desde ahí. Así no quedan huecos de media hora
 * que nadie puede usar, que es lo que pasaba con una grilla cada 30 minutos y
 * citas de 75.
 */
export function bloquesDelDia(horario: HorarioDelDia, duracion: number = CITA.duracionMin): number[] {
  const bloques: number[] = [];
  for (const [inicio, fin] of tramosDelDia(horario)) {
    for (let minuto = inicio; minuto + duracion <= fin; minuto += duracion) {
      bloques.push(minuto);
    }
  }
  return bloques;
}

/**
 * Lo que sobra al final de cada tramo, para avisar al editar el horario.
 *
 * Si la tarde va de 14:00 a 18:00 caben tres citas y sobran 15 minutos. No es
 * un error, pero quien edita el horario debería saberlo.
 */
export function sobranteDelDia(horario: HorarioDelDia, duracion: number = CITA.duracionMin): number {
  return tramosDelDia(horario).reduce((total, [inicio, fin]) => total + ((fin - inicio) % duracion), 0);
}
