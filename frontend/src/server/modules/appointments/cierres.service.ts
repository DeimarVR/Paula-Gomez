import { AppointmentStatus, SlotOfferStatus } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { conCerrojoDeAgenda } from '../../lib/cerrojo';
import { HttpError } from '../../lib/httpError';
import { addMinutes, parseZonedDateTime, toZonedDateKey } from '../../lib/datetime';
import { buildWhatsAppLink } from '../../lib/phone';
import { createLogger } from '../../lib/logger';
import * as calendar from '../../services/googleCalendar';
import * as whatsapp from '../../services/whatsapp';
import { conNota, enlaceDeCita, telefonoUsable } from './eventoDeCita';

const log = createLogger('cierres');

const ACTIVAS = [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Cerrar un día completo.
 *
 * «Hoy no atiendo»: el día deja de aceptar citas desde la web y desde el
 * panel, y a quien ya tenía cita se le cancela y se le escribe una disculpa a
 * nombre de la especialista, con un enlace para elegir otra hora él mismo.
 *
 * El día cerrado es una fila de `blackouts` con `dateKey`. Esa fila es lo que
 * tapa la agenda —la misma que ya respetaban la web y el panel— y borrarla es
 * reabrir el día.
 *
 * Las citas no se borran: quedan canceladas con `needsReschedule`, que es lo
 * que hace que su enlace ofrezca «elegir otro horario» en vez de un seco
 * «cita cancelada». Reabrir el día NO las devuelve: para entonces la persona
 * pudo haber elegido otra hora, y revivirlas a escondidas crearía citas
 * dobles.
 */

/** Medianoche a medianoche en la zona del centro. */
function limitesDelDia(fecha: string): { inicio: Date; fin: Date } {
  const zona = env.CLINIC_TIMEZONE;
  const inicio = parseZonedDateTime(fecha, '00:00', zona);
  // 36 horas después siempre cae en el día siguiente, haya o no cambio de hora.
  const siguiente = toZonedDateKey(addMinutes(inicio, 36 * 60), zona);
  return { inicio, fin: parseZonedDateTime(siguiente, '00:00', zona) };
}

function validarFecha(fecha: string): void {
  if (!FECHA.test(fecha)) throw HttpError.badRequest('La fecha no es válida.');
}

export interface CitaAfectada {
  id: string;
  nombre: string;
  telefono: string;
  startsAt: Date;
  avisoEnviado: boolean;
  /** wa.me con la disculpa completa, para mandarla a mano si no salió sola. */
  enlaceManual: string | null;
}

export async function cerrarDia(fecha: string, opciones: { motivo?: string | null } = {}) {
  validarFecha(fecha);
  const zona = env.CLINIC_TIMEZONE;
  if (fecha < toZonedDateKey(new Date(), zona)) {
    throw HttpError.badRequest('Ese día ya pasó.');
  }

  const motivo = opciones.motivo?.trim() || null;
  const { inicio, fin } = limitesDelDia(fecha);

  const resultado = await conCerrojoDeAgenda(async (tx) => {
    const yaEstaba = await tx.blackout.findUnique({ where: { dateKey: fecha } });
    if (yaEstaba) return null;

    await tx.blackout.create({
      data: { startsAt: inicio, endsAt: fin, reason: motivo, dateKey: fecha },
    });

    /*
     * Solo lo que todavía no empezó. Si se cierra el día a las 2 de la tarde,
     * la cita de las 8 ya pasó —se atendió, o no vino— y escribirle una
     * disculpa por una cita de esta mañana sería un disparate.
     */
    const ahora = new Date();
    const afectadas = await tx.appointment.findMany({
      where: {
        status: { in: ACTIVAS },
        startsAt: { gte: inicio > ahora ? inicio : ahora, lt: fin },
      },
      orderBy: { startsAt: 'asc' },
    });

    for (const cita of afectadas) {
      await tx.appointment.update({
        where: { id: cita.id },
        data: {
          status: AppointmentStatus.CANCELADA,
          needsReschedule: true,
          closureNoticeSentAt: null,
          googleEventId: null,
          message: conNota(cita.message, 'Día cerrado', motivo ?? 'sin motivo'),
        },
      });
    }

    // Lo que se estaba ofreciendo ese día ya no se puede tomar.
    await tx.slotOffer.updateMany({
      where: { status: SlotOfferStatus.ABIERTA, startsAt: { lt: fin }, endsAt: { gt: inicio } },
      data: { status: SlotOfferStatus.ANULADA },
    });

    return afectadas;
  });

  if (!resultado) throw HttpError.conflict('Ese día ya está cerrado.');

  /*
   * Google y WhatsApp, fuera del cerrojo y en paralelo. El día ya está cerrado
   * en la base; si un mensaje no sale, queda pendiente en el panel con su
   * enlace para mandarlo a mano.
   */
  const afectadas: CitaAfectada[] = await Promise.all(
    resultado.map(async (cita) => {
      if (cita.googleEventId) {
        await calendar
          .deleteEvent(cita.googleEventId)
          .catch((error) => log.warn('No se pudo borrar el evento', error));
      }

      if (!telefonoUsable(cita.contactPhone)) {
        return {
          id: cita.id,
          nombre: cita.contactName,
          telefono: cita.contactPhone,
          startsAt: cita.startsAt,
          avisoEnviado: false,
          enlaceManual: null,
        };
      }

      const envio = await whatsapp.sendDiaCerrado(cita.contactPhone, {
        cuando: cita.startsAt,
        motivo,
        enlace: enlaceDeCita(cita.manageToken),
      });
      if (envio.sent) {
        await prisma.appointment.update({
          where: { id: cita.id },
          data: { closureNoticeSentAt: new Date() },
        });
      }

      return {
        id: cita.id,
        nombre: cita.contactName,
        telefono: cita.contactPhone,
        startsAt: cita.startsAt,
        avisoEnviado: envio.sent,
        enlaceManual: envio.fallbackLink,
      };
    }),
  );

  log.info(`Día ${fecha} cerrado: ${afectadas.length} cita(s) canceladas`);
  return { fecha, motivo, afectadas };
}

export async function reabrirDia(fecha: string) {
  validarFecha(fecha);
  const cierre = await prisma.blackout.findUnique({ where: { dateKey: fecha } });
  if (!cierre) throw HttpError.notFound('Ese día no está cerrado.');

  await prisma.blackout.delete({ where: { id: cierre.id } });

  const { inicio, fin } = limitesDelDia(fecha);
  const siguenCanceladas = await prisma.appointment.count({
    where: {
      needsReschedule: true,
      status: AppointmentStatus.CANCELADA,
      startsAt: { gte: inicio, lt: fin },
    },
  });

  return { fecha, siguenCanceladas };
}

/**
 * Lo que el panel necesita para la sección de cierres.
 *
 * - Los días cerrados de hoy en adelante, para reabrirlos.
 * - Las disculpas que no salieron solas, con su enlace listo.
 * - Quienes recibieron la disculpa y todavía no eligieron otra hora: a esos
 *   hay que llamarlos.
 */
export async function estadoDeCierres() {
  const zona = env.CLINIC_TIMEZONE;
  const hoy = toZonedDateKey(new Date(), zona);

  const dias = await prisma.blackout.findMany({
    where: { dateKey: { gte: hoy } },
    orderBy: { dateKey: 'asc' },
    select: { dateKey: true, reason: true },
  });

  const pendientes = await prisma.appointment.findMany({
    where: { needsReschedule: true, status: AppointmentStatus.CANCELADA },
    orderBy: { startsAt: 'asc' },
    take: 100,
    select: {
      id: true,
      contactName: true,
      contactPhone: true,
      startsAt: true,
      manageToken: true,
      closureNoticeSentAt: true,
    },
  });

  // El motivo vive en el cierre; si ya se reabrió el día, no hay motivo que citar.
  const motivos = new Map(
    (
      await prisma.blackout.findMany({
        where: { dateKey: { in: [...new Set(pendientes.map((p) => toZonedDateKey(p.startsAt, zona)))] } },
        select: { dateKey: true, reason: true },
      })
    ).map((b) => [b.dateKey, b.reason]),
  );

  const conEnlace = pendientes.map((cita) => ({
    id: cita.id,
    nombre: cita.contactName,
    telefono: cita.contactPhone,
    startsAt: cita.startsAt,
    avisoEnviadoEn: cita.closureNoticeSentAt,
    enlaceManual: telefonoUsable(cita.contactPhone)
      ? buildWhatsAppLink(
          cita.contactPhone,
          whatsapp.buildDiaCerradoText({
            cuando: cita.startsAt,
            motivo: motivos.get(toZonedDateKey(cita.startsAt, zona)) ?? null,
            enlace: enlaceDeCita(cita.manageToken),
          }),
        )
      : null,
  }));

  return {
    dias: dias.map((d) => ({ fecha: d.dateKey as string, motivo: d.reason })),
    pendientesDeAviso: conEnlace.filter((c) => !c.avisoEnviadoEn),
    pendientesDeReagendar: conEnlace.filter((c) => c.avisoEnviadoEn),
  };
}

export async function marcarAvisoEnviado(citaId: string) {
  const cita = await prisma.appointment.findUnique({ where: { id: citaId } });
  if (!cita || !cita.needsReschedule) throw HttpError.notFound('No hay aviso pendiente para esa cita.');
  return prisma.appointment.update({
    where: { id: citaId },
    data: { closureNoticeSentAt: cita.closureNoticeSentAt ?? new Date() },
    select: { id: true, closureNoticeSentAt: true },
  });
}
