import { AppointmentStatus, SlotOfferStatus } from '@prisma/client';
import {
  CITA,
  OFERTA_CIERRE_MIN,
  OFERTA_MARGEN_MIN,
  OFERTA_MAX_INVITADOS,
} from '@/lib/agenda';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { conCerrojoDeAgenda, type Tx } from '../../lib/cerrojo';
import { HttpError } from '../../lib/httpError';
import { addDays, addMinutes, formatLongEs } from '../../lib/datetime';
import { buildWhatsAppLink } from '../../lib/phone';
import { fechaEnPalabras } from '@/lib/mensajesCita';
import { tokenDeEnlace } from '../../lib/tokens';
import { createLogger } from '../../lib/logger';
import { assertSlotIsFree } from '../../services/availability';
import * as calendar from '../../services/googleCalendar';
import * as whatsapp from '../../services/whatsapp';
import { enlaceDeOferta, ponerEnGoogle, telefonoUsable } from './eventoDeCita';

const log = createLogger('ofertas');

const ACTIVAS = [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA];

/**
 * Ofrecer el hueco que deja una cita.
 *
 * Cuando alguien cancela, avisa que no vendrá o se mueve a otro día, su hora
 * queda libre. Se le ofrece a quienes tienen cita MÁS ADELANTE —los más
 * cercanos primero, hasta cinco—, cada uno con su enlace. El primero que lo
 * toma se lo queda y su cita se adelanta; a los demás el enlace les dice que
 * ya fue tomado. Y la hora que deja libre quien se adelantó se vuelve a
 * ofrecer con las mismas reglas: es una cadena.
 *
 * Lo que NO hace:
 *  - Ofrecer con menos de tres horas: nadie alcanza a reorganizarse.
 *  - Ofrecer una hora que en el medio ya tomó otra persona.
 *  - Mandarle a alguien dos ofertas a la vez.
 *  - Ofrecer el hueco de quien no vino. Esa hora ya pasó: el margen de tres
 *    horas lo descarta solo.
 */

/** Anula las ofertas abiertas que pisan un horario que se acaba de ocupar. */
export async function anularOfertasQuePisan(tx: Tx, desde: Date, hasta: Date): Promise<void> {
  await tx.slotOffer.updateMany({
    where: { status: SlotOfferStatus.ABIERTA, startsAt: { lt: hasta }, endsAt: { gt: desde } },
    data: { status: SlotOfferStatus.ANULADA },
  });
}

/** Ya no da tiempo de aceptarla aunque nadie la haya tomado. */
function seCerro(oferta: { startsAt: Date }, ahora = new Date()): boolean {
  return oferta.startsAt < addMinutes(ahora, OFERTA_CIERRE_MIN);
}

export interface HuecoLiberado {
  startsAt: Date;
  endsAt: Date;
  /** La cita que lo dejó libre. No se le ofrece a ella misma. */
  origenCitaId?: string;
  /** Ni a otra cita de la misma persona: no tiene sentido ofrecerle lo que soltó. */
  origenTelefono?: string;
}

export interface ResultadoOferta {
  ofertaId: string | null;
  invitados: number;
  enviados: number;
  /** Por qué no se ofreció, cuando no se ofreció. */
  motivo?: 'muy-pronto' | 'no-esta-libre' | 'ya-ofrecido' | 'sin-candidatos';
}

/**
 * Nunca lanza. Ofrecer el hueco es un extra de cancelar o mover una cita: si
 * algo falla aquí, lo que la persona pidió ya está hecho y no se le puede
 * devolver un error por esto.
 */
export async function ofrecerHuecoLiberado(hueco: HuecoLiberado): Promise<ResultadoOferta> {
  try {
    return await ofrecer(hueco);
  } catch (error) {
    log.error('No se pudo ofrecer el hueco liberado', error);
    return { ofertaId: null, invitados: 0, enviados: 0 };
  }
}

async function ofrecer(hueco: HuecoLiberado): Promise<ResultadoOferta> {
  const ahora = new Date();
  if (hueco.startsAt < addMinutes(ahora, OFERTA_MARGEN_MIN)) {
    return { ofertaId: null, invitados: 0, enviados: 0, motivo: 'muy-pronto' };
  }

  const ocupadoGoogle = await calendar.getBusyIntervals(hueco.startsAt, hueco.endsAt);

  const resultado = await conCerrojoDeAgenda(async (tx) => {
    /*
     * ¿Sigue libre? Entre que se liberó y este momento alguien pudo reservarlo
     * desde la web. Se comprueba con las reglas del panel —sin márgenes de la
     * web ni exigir el comienzo de un bloque— porque la hora salió de una cita
     * real, que pudo haberse puesto a las 8:30 desde el mostrador.
     */
    try {
      await assertSlotIsFree(tx, hueco.startsAt, hueco.endsAt, {
        desdeElPanel: true,
        ocupadoGoogle,
      });
    } catch (error) {
      if (error instanceof HttpError) return { motivo: 'no-esta-libre' as const };
      throw error;
    }

    const yaOfrecido = await tx.slotOffer.findFirst({
      where: {
        status: SlotOfferStatus.ABIERTA,
        startsAt: { lt: hueco.endsAt },
        endsAt: { gt: hueco.startsAt },
      },
      select: { id: true },
    });
    if (yaOfrecido) return { motivo: 'ya-ofrecido' as const };

    // Quien ya tiene una invitación esperando respuesta no recibe otra.
    const ocupadas = await tx.slotOfferInvite.findMany({
      where: {
        declinedAt: null,
        acceptedAt: null,
        offer: { status: SlotOfferStatus.ABIERTA, startsAt: { gte: addMinutes(ahora, OFERTA_CIERRE_MIN) } },
      },
      select: { appointmentId: true },
    });
    const excluidas = new Set(ocupadas.map((i) => i.appointmentId));
    if (hueco.origenCitaId) excluidas.add(hueco.origenCitaId);

    const posibles = await tx.appointment.findMany({
      where: {
        status: { in: ACTIVAS },
        startsAt: { gt: hueco.startsAt },
        id: { notIn: [...excluidas] },
        ...(hueco.origenTelefono ? { contactPhone: { not: hueco.origenTelefono } } : {}),
      },
      orderBy: { startsAt: 'asc' },
      // De más, porque abajo se descartan teléfonos repetidos y vacíos.
      take: OFERTA_MAX_INVITADOS * 4,
      select: { id: true, contactPhone: true },
    });

    /*
     * Una invitación por persona: si alguien tiene dos citas más adelante, se
     * le ofrece adelantar la más próxima, que es la primera que aparece.
     */
    const vistos = new Set<string>();
    const elegidas = posibles
      .filter((c) => {
        if (!telefonoUsable(c.contactPhone) || vistos.has(c.contactPhone)) return false;
        vistos.add(c.contactPhone);
        return true;
      })
      .slice(0, OFERTA_MAX_INVITADOS);

    if (elegidas.length === 0) return { motivo: 'sin-candidatos' as const };

    const oferta = await tx.slotOffer.create({
      data: {
        startsAt: hueco.startsAt,
        endsAt: hueco.endsAt,
        sourceAppointmentId: hueco.origenCitaId ?? null,
        invites: {
          create: elegidas.map((c) => ({ appointmentId: c.id, token: tokenDeEnlace() })),
        },
      },
      include: {
        invites: { include: { appointment: { select: { contactPhone: true, startsAt: true } } } },
      },
    });
    return { oferta };
  });

  const oferta = 'oferta' in resultado ? resultado.oferta : undefined;
  if (!oferta) {
    return {
      ofertaId: null,
      invitados: 0,
      enviados: 0,
      motivo: 'motivo' in resultado ? resultado.motivo : undefined,
    };
  }

  // Fuera de la transacción: son llamadas a Meta, y la agenda no puede quedar
  // esperándolas con el cerrojo tomado.
  const enviados = await Promise.all(
    oferta.invites.map(async (invitacion) => {
      const envio = await whatsapp.sendOfertaHueco(invitacion.appointment.contactPhone, {
        nuevo: oferta.startsAt,
        actual: invitacion.appointment.startsAt,
        enlace: enlaceDeOferta(invitacion.token),
      });
      if (!envio.sent) return false;
      await prisma.slotOfferInvite.update({
        where: { id: invitacion.id },
        data: { sentAt: new Date() },
      });
      return true;
    }),
  );

  const cuantos = enviados.filter(Boolean).length;
  log.info(`Hueco ofrecido a ${oferta.invites.length} (${cuantos} por WhatsApp automático)`);

  return { ofertaId: oferta.id, invitados: oferta.invites.length, enviados: cuantos };
}

/* ------------------------------------------------------------------------- */
/* Lo que ve el paciente al abrir su enlace                                  */
/* ------------------------------------------------------------------------- */

export type EstadoInvitacion =
  /** Puede tomarlo. */
  | 'abierta'
  /** Lo tomó esta misma persona: su cita ya está en la hora nueva. */
  | 'suya'
  /** Lo tomó otra persona, o se ocupó por otro camino. */
  | 'tomada'
  /** Se acercó la hora sin que nadie lo tomara. */
  | 'vencida'
  /** Su cita ya no está donde estaba: la canceló, la movió o ya es antes. */
  | 'cita-cambiada';

async function leerInvitacion(token: string) {
  const invitacion = await prisma.slotOfferInvite.findUnique({
    where: { token },
    include: {
      offer: true,
      appointment: {
        select: { id: true, status: true, startsAt: true, contactName: true },
      },
    },
  });
  if (!invitacion) throw HttpError.notFound('Este enlace no es válido o ya no existe.');
  return invitacion;
}

function estadoDe(invitacion: Awaited<ReturnType<typeof leerInvitacion>>): EstadoInvitacion {
  const { offer, appointment } = invitacion;

  if (offer.status === SlotOfferStatus.TOMADA) {
    return offer.takenByAppointmentId === appointment.id ? 'suya' : 'tomada';
  }
  if (offer.status === SlotOfferStatus.ANULADA) return 'tomada';
  if (offer.status === SlotOfferStatus.VENCIDA || seCerro(offer)) return 'vencida';
  if (!ACTIVAS.includes(appointment.status as (typeof ACTIVAS)[number])) return 'cita-cambiada';
  if (appointment.startsAt <= offer.startsAt) return 'cita-cambiada';
  return 'abierta';
}

export async function verOferta(token: string) {
  const invitacion = await leerInvitacion(token);
  const estado = estadoDe(invitacion);
  const zona = env.CLINIC_TIMEZONE;

  return {
    estado,
    rechazada: Boolean(invitacion.declinedAt),
    // Con las mismas palabras del WhatsApp que recibió: «lunes 9 de noviembre a las 10:30 am».
    nuevo: {
      startsAt: invitacion.offer.startsAt,
      texto: fechaEnPalabras(invitacion.offer.startsAt, zona),
    },
    actual: {
      startsAt: invitacion.appointment.startsAt,
      texto: fechaEnPalabras(invitacion.appointment.startsAt, zona),
    },
    duracionMin: CITA.duracionMin,
    clinic: {
      name: env.CLINIC_NAME,
      address: env.CLINIC_ADDRESS,
      whatsapp: env.CLINIC_WHATSAPP,
    },
  };
}

type Desenlace =
  | { tipo: 'aceptada'; citaId: string; antes: { startsAt: Date; endsAt: Date } }
  | { tipo: 'ya-era-suya' }
  | { tipo: 'tomada' }
  | { tipo: 'vencida' }
  | { tipo: 'cita-cambiada' };

/**
 * Tomar el hueco: el primero que llega se lo queda.
 *
 * Lo que decide quién llegó primero es el cerrojo de la agenda. Si dos
 * personas pulsan a la vez, la segunda espera a que la primera termine y para
 * entonces la oferta ya dice TOMADA.
 *
 * Los desenlaces se devuelven en vez de lanzarse dentro de la transacción: si
 * se lanzara, se desharía también la marca de «vencida» que se pone de paso.
 */
export async function aceptarOferta(token: string) {
  const invitacion = await leerInvitacion(token);
  const { offer } = invitacion;
  const finNuevo = addMinutes(offer.startsAt, CITA.duracionMin);
  const ocupadoGoogle = await calendar.getBusyIntervals(offer.startsAt, finNuevo);

  const desenlace = await conCerrojoDeAgenda<Desenlace>(async (tx) => {
    const oferta = await tx.slotOffer.findUniqueOrThrow({ where: { id: offer.id } });
    const cita = await tx.appointment.findUniqueOrThrow({ where: { id: invitacion.appointmentId } });
    const ahora = new Date();

    if (oferta.status === SlotOfferStatus.TOMADA) {
      return oferta.takenByAppointmentId === cita.id ? { tipo: 'ya-era-suya' } : { tipo: 'tomada' };
    }
    if (oferta.status === SlotOfferStatus.ANULADA) return { tipo: 'tomada' };
    if (oferta.status === SlotOfferStatus.VENCIDA) return { tipo: 'vencida' };
    if (seCerro(oferta, ahora)) {
      await tx.slotOffer.update({
        where: { id: oferta.id },
        data: { status: SlotOfferStatus.VENCIDA },
      });
      return { tipo: 'vencida' };
    }
    if (
      !ACTIVAS.includes(cita.status as (typeof ACTIVAS)[number]) ||
      cita.startsAt <= oferta.startsAt
    ) {
      return { tipo: 'cita-cambiada' };
    }

    try {
      await assertSlotIsFree(tx, oferta.startsAt, finNuevo, {
        desdeElPanel: true,
        excluirCitaId: cita.id,
        ocupadoGoogle,
      });
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      // Se ocupó por otro camino. La oferta ya no tiene nada que ofrecer.
      await tx.slotOffer.update({
        where: { id: oferta.id },
        data: { status: SlotOfferStatus.ANULADA },
      });
      return { tipo: 'tomada' };
    }

    await tx.appointment.update({
      where: { id: cita.id },
      data: {
        startsAt: oferta.startsAt,
        endsAt: finNuevo,
        // La eligió ella misma hace un segundo: no hay nada más que confirmar.
        status: AppointmentStatus.CONFIRMADA,
        whatsappReminderSentAt: null,
      },
    });
    await tx.slotOffer.update({
      where: { id: oferta.id },
      data: { status: SlotOfferStatus.TOMADA, takenByAppointmentId: cita.id, takenAt: ahora },
    });
    await tx.slotOfferInvite.update({
      where: { id: invitacion.id },
      data: { acceptedAt: ahora, declinedAt: null },
    });
    await anularOfertasQuePisan(tx, oferta.startsAt, finNuevo);

    return {
      tipo: 'aceptada',
      citaId: cita.id,
      antes: { startsAt: cita.startsAt, endsAt: cita.endsAt },
    };
  });

  switch (desenlace.tipo) {
    case 'tomada':
      throw HttpError.conflict(
        'Este espacio ya fue tomado por otra persona. Su cita actual se mantiene igual.',
      );
    case 'vencida':
      throw HttpError.conflict('Este espacio ya no está disponible. Su cita actual se mantiene igual.');
    case 'cita-cambiada':
      throw HttpError.conflict(
        'Su cita cambió desde que le enviamos este mensaje, así que el espacio ya no aplica.',
      );
    case 'ya-era-suya':
      return verOferta(token);
    case 'aceptada':
      await despuesDeAceptar(desenlace.citaId, desenlace.antes);
      return verOferta(token);
  }
}

/** Google, mensajes y la cadena. Nada de esto puede deshacer lo ya aceptado. */
async function despuesDeAceptar(citaId: string, antes: { startsAt: Date; endsAt: Date }) {
  const cita = await prisma.appointment.findUniqueOrThrow({ where: { id: citaId } });
  const zona = env.CLINIC_TIMEZONE;

  await ponerEnGoogle(cita).catch((error) => log.warn('No se pudo mover el evento', error));

  await Promise.all([
    whatsapp
      .sendAppointmentConfirmation({
        contactName: cita.contactName,
        contactPhone: cita.contactPhone,
        serviceName: CITA.nombre,
        startsAt: cita.startsAt,
        manageToken: cita.manageToken,
      })
      .catch((error) => log.warn('No se pudo confirmar la cita adelantada', error)),
    whatsapp
      .sendText(
        env.CLINIC_WHATSAPP,
        [
          '🔁 Cita adelantada con un hueco liberado',
          '',
          `Paciente: ${cita.contactName}`,
          `Antes: ${formatLongEs(antes.startsAt, zona)}`,
          `Ahora: ${formatLongEs(cita.startsAt, zona)}`,
        ].join('\n'),
      )
      .catch((error) => log.warn('No se pudo avisar al centro', error)),
  ]);

  // La cadena: la hora que soltó esta persona se ofrece a quienes van después.
  await ofrecerHuecoLiberado({
    startsAt: antes.startsAt,
    endsAt: antes.endsAt,
    origenCitaId: cita.id,
    origenTelefono: cita.contactPhone,
  });
}

/** «No me interesa». No cambia nada de su cita; solo deja de contar para el panel. */
export async function rechazarOferta(token: string) {
  const invitacion = await leerInvitacion(token);
  if (!invitacion.acceptedAt && !invitacion.declinedAt) {
    await prisma.slotOfferInvite.update({
      where: { id: invitacion.id },
      data: { declinedAt: new Date() },
    });
  }
  return { message: 'Listo. Su cita se mantiene igual.' };
}

/* ------------------------------------------------------------------------- */
/* Panel                                                                     */
/* ------------------------------------------------------------------------- */

/**
 * Las ofertas recientes, con lo que hace falta para mandarlas a mano.
 *
 * Mientras no estén aprobadas las plantillas en Meta, el WhatsApp automático
 * no sale. El panel enseña cada invitación con su enlace de wa.me ya escrito:
 * recepción lo abre, pulsa enviar y la marca como enviada.
 */
export async function listarOfertas() {
  const ahora = new Date();
  const ofertas = await prisma.slotOffer.findMany({
    where: {
      OR: [{ status: SlotOfferStatus.ABIERTA }, { createdAt: { gte: addDays(ahora, -7) } }],
    },
    orderBy: { startsAt: 'asc' },
    take: 50,
    include: {
      invites: {
        orderBy: { createdAt: 'asc' },
        include: {
          appointment: {
            select: { id: true, contactName: true, contactPhone: true, startsAt: true, status: true },
          },
        },
      },
    },
  });

  return ofertas.map((oferta) => {
    const estado =
      oferta.status === SlotOfferStatus.ABIERTA && seCerro(oferta, ahora)
        ? SlotOfferStatus.VENCIDA
        : oferta.status;
    const tomadaPor = oferta.invites.find((i) => i.appointmentId === oferta.takenByAppointmentId);

    return {
      id: oferta.id,
      startsAt: oferta.startsAt,
      endsAt: oferta.endsAt,
      estado,
      creadaEn: oferta.createdAt,
      tomadaPor: tomadaPor ? tomadaPor.appointment.contactName : null,
      invitaciones: oferta.invites.map((i) => ({
        id: i.id,
        citaId: i.appointment.id,
        nombre: i.appointment.contactName,
        telefono: i.appointment.contactPhone,
        citaActual: i.appointment.startsAt,
        enviadaEn: i.sentAt,
        aceptadaEn: i.acceptedAt,
        rechazadaEn: i.declinedAt,
        // Solo mientras sirva mandarla: una oferta cerrada no se reenvía.
        enlaceManual:
          estado === SlotOfferStatus.ABIERTA && telefonoUsable(i.appointment.contactPhone)
            ? buildWhatsAppLink(
                i.appointment.contactPhone,
                whatsapp.buildOfertaHuecoText({
                  nuevo: oferta.startsAt,
                  actual: i.appointment.startsAt,
                  enlace: enlaceDeOferta(i.token),
                }),
              )
            : null,
      })),
    };
  });
}

export async function marcarInvitacionEnviada(id: string) {
  const invitacion = await prisma.slotOfferInvite.findUnique({ where: { id } });
  if (!invitacion) throw HttpError.notFound('Invitación no encontrada');
  return prisma.slotOfferInvite.update({
    where: { id },
    data: { sentAt: invitacion.sentAt ?? new Date() },
    select: { id: true, sentAt: true },
  });
}

/** Para la tarea diaria: deja en VENCIDA lo que ya no se puede tomar. */
export async function vencerOfertas(): Promise<string> {
  const { count } = await prisma.slotOffer.updateMany({
    where: {
      status: SlotOfferStatus.ABIERTA,
      startsAt: { lt: addMinutes(new Date(), OFERTA_CIERRE_MIN) },
    },
    data: { status: SlotOfferStatus.VENCIDA },
  });
  return `ofertas vencidas: ${count}`;
}
