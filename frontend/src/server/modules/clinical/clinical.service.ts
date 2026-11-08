import { AppointmentSource, AppointmentStatus, CareType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import { fechaDesdeClave } from '../../lib/fechaDia';
import { parseZonedDateTime } from '../../lib/datetime';
import { env } from '../../config/env';
import { createLogger } from '../../lib/logger';
import { variantesDeAcento } from '../../lib/acentos';
import * as citas from '../appointments/appointments.service';

const log = createLogger('control-pacientes');

/**
 * Ficha de control evolutivo.
 *
 * Reproduce la hoja de papel del centro: un bloque de datos del paciente y una
 * tabla con una fila por sesión.
 *
 * Es INDEPENDIENTE de los planes y sesiones que ya existen. Se decidió así
 * para no tocar el portal de seguimiento del paciente, que hoy funciona. El
 * costo, asumido a conciencia, es que una visita puede quedar registrada en
 * los dos lados.
 */

type LineaEntrada = {
  sessionDate: string;
  controlLabel?: string | null;
  alopeciaType?: string | null;
  treatment?: string | null;
  treatedZone?: string | null;
  oralMedication?: string | null;
  topicalMedication?: string | null;
  shampoo?: string | null;
  findings?: string | null;
  nextControl?: string | null;
  nextControlTime?: string | null;
  nextControlServiceId?: string | null;
  professionalSignature?: string | null;
  patientSignature?: string | null;
  /**
   * Id de la fila si ya existía.
   *
   * Se usa para CASAR las filas al actualizar en vez de borrarlas todas: si se
   * borraran, se perdería el vínculo con la cita ya agendada y al guardar de
   * nuevo se crearía una cita repetida.
   */
  id?: string | null;
};

export type FichaEntrada = {
  patientId: string;
  procedureDate: string;
  patientName: string;
  patientDocument?: string | null;
  patientAge?: number | null;
  patientPhone?: string | null;
  careType: CareType;
  totalSessions?: number | null;
  transplantBeard: boolean;
  transplantEyebrows: boolean;
  transplantScalp: boolean;
  transplantZones: number[];
  follicles?: number | null;
  folliclesLost?: number | null;
  warranty?: string | null;
  markedZones: string[];
  notes?: string | null;
  entries: LineaEntrada[];
};

const limpio = (valor: string | null | undefined) => valor?.trim() || null;

/** Traduce las filas del formulario a lo que espera Prisma. */
function prepararLineas(entries: LineaEntrada[]) {
  return entries.map((linea, indice) => ({
    sessionDate: fechaDesdeClave(linea.sessionDate),
    controlLabel: limpio(linea.controlLabel),
    alopeciaType: limpio(linea.alopeciaType),
    treatment: limpio(linea.treatment),
    treatedZone: limpio(linea.treatedZone),
    oralMedication: limpio(linea.oralMedication),
    topicalMedication: limpio(linea.topicalMedication),
    shampoo: limpio(linea.shampoo),
    findings: limpio(linea.findings),
    nextControl: linea.nextControl ? fechaDesdeClave(linea.nextControl) : null,
    nextControlTime: limpio(linea.nextControlTime),
    nextControlServiceId: limpio(linea.nextControlServiceId),
    professionalSignature: linea.professionalSignature ?? null,
    patientSignature: linea.patientSignature ?? null,
    sortOrder: indice,
  }));
}

/** Los campos de cabecera, comunes a crear y actualizar. */
function prepararCabecera(datos: FichaEntrada) {
  return {
    procedureDate: fechaDesdeClave(datos.procedureDate),
    patientName: datos.patientName.trim(),
    patientDocument: limpio(datos.patientDocument),
    patientAge: datos.patientAge ?? null,
    patientPhone: limpio(datos.patientPhone),
    careType: datos.careType,
    totalSessions: datos.totalSessions ?? null,
    transplantBeard: datos.transplantBeard,
    transplantEyebrows: datos.transplantEyebrows,
    transplantScalp: datos.transplantScalp,
    // Ordenadas y sin repetidos: el formulario alterna casillas y un doble
    // clic no puede dejar [1,1,2] guardado.
    transplantZones: [...new Set(datos.transplantZones)].sort((a, b) => a - b),
    follicles: datos.follicles ?? null,
    folliclesLost: datos.folliclesLost ?? null,
    warranty: limpio(datos.warranty),
    markedZones: [...new Set(datos.markedZones)],
    notes: limpio(datos.notes),
  };
}

const CON_DETALLE = {
  entries: {
    orderBy: { sortOrder: 'asc' },
    include: {
      nextControlAppointment: {
        select: { id: true, startsAt: true, status: true, googleHtmlLink: true },
      },
    },
  },
  patient: { select: { id: true, fullName: true } },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ClinicalRecordInclude;

export async function crear(datos: FichaEntrada, createdById?: string) {
  const paciente = await prisma.patient.findUnique({ where: { id: datos.patientId } });
  if (!paciente) throw HttpError.unprocessable('El paciente no existe');

  return prisma.clinicalRecord.create({
    data: {
      ...prepararCabecera(datos),
      patientId: datos.patientId,
      createdById: createdById ?? null,
      entries: { create: prepararLineas(datos.entries) },
    },
    include: CON_DETALLE,
  });
}

export async function actualizar(id: string, datos: FichaEntrada) {
  const existente = await prisma.clinicalRecord.findUnique({ where: { id } });
  if (!existente) throw HttpError.notFound('Ficha no encontrada');

  /*
   * Las filas se CASAN por id, no se borran y recrean.
   *
   * Antes se borraban todas y se volvían a crear, que es más simple. Dejó de
   * servir cuando una fila pasó a tener una cita asociada: al borrarla se
   * perdía el vínculo y el siguiente guardado agendaba una cita repetida.
   */
  const conservadas = datos.entries
    .map((linea) => linea.id)
    .filter((valor): valor is string => Boolean(valor));

  const preparadas = prepararLineas(datos.entries);

  return prisma.$transaction(async (tx) => {
    // Las que la persona quitó del formulario.
    await tx.clinicalEntry.deleteMany({
      where: { recordId: id, id: { notIn: conservadas.length > 0 ? conservadas : ['ninguna'] } },
    });

    for (const [indice, linea] of preparadas.entries()) {
      const idLinea = datos.entries[indice].id;
      if (idLinea) {
        await tx.clinicalEntry.update({ where: { id: idLinea }, data: linea });
      } else {
        await tx.clinicalEntry.create({ data: { ...linea, recordId: id } });
      }
    }

    return tx.clinicalRecord.update({
      where: { id },
      data: { ...prepararCabecera(datos), patientId: datos.patientId },
      include: CON_DETALLE,
    });
  });
}

export async function obtener(id: string) {
  const ficha = await prisma.clinicalRecord.findUnique({ where: { id }, include: CON_DETALLE });
  if (!ficha) throw HttpError.notFound('Ficha no encontrada');
  return ficha;
}

/**
 * Las palabras de la búsqueda, todas obligatorias.
 *
 * Antes se buscaba la frase entera como un solo pedazo de texto: escribir
 * «Juan Moncayo» no encontraba a «juan david moncayo muñoz» —porque esas dos
 * palabras no van pegadas— y en cambio, mientras se terminaba de escribir, la
 * respuesta de «Juan» llegaba tarde y pintaba a todos los Juan del centro. El
 * resultado era una lista llena de gente que no se estaba buscando.
 *
 * Ahora cada palabra tiene que aparecer en ALGÚN dato del paciente: nombre,
 * documento o teléfono. «Juan Moncayo» encuentra a Juan David Moncayo Muñoz y
 * NO a Juan Carlos España, porque a ese le falta «moncayo». Y si no hay nadie,
 * no sale nadie: es lo que se pidió.
 */
function palabrasDe(q: string | undefined): string[] {
  return (q ?? '').trim().split(/\s+/).filter(Boolean);
}

function condicionDeBusqueda(q: string | undefined): Prisma.ClinicalRecordWhereInput[] {
  return palabrasDe(q).map((palabra) => ({
    OR: variantesDeAcento(palabra).flatMap((v) => [
      { patientName: { contains: v, mode: 'insensitive' as const } },
      { patientDocument: { contains: v } },
      { patientPhone: { contains: v } },
    ]),
  }));
}

/** Lo mismo, para la tabla de fichas faciales. */
function condicionFacial(q: string | undefined): Prisma.FacialRecordWhereInput[] {
  return palabrasDe(q).map((palabra) => ({
    OR: variantesDeAcento(palabra).flatMap((v) => [
      { patientName: { contains: v, mode: 'insensitive' as const } },
      { patientDocument: { contains: v } },
      { patientPhone: { contains: v } },
    ]),
  }));
}

/** Los tres tipos de ficha que se pueden filtrar en el listado. */
export type TipoDeFicha = CareType | 'FACIAL';

/**
 * El listado junta las fichas capilares y las faciales.
 *
 * Viven en tablas distintas —la facial no tiene zonas ni folículos, y forzarlas
 * en una sola tabla habría llenado cada fila de columnas vacías—, pero para
 * quien busca a un paciente eso es un detalle interno: quiere ver sus fichas,
 * no dos listas. Se piden las dos y se mezclan acá.
 *
 * El precio: la paginación se hace sobre la mezcla, así que se piden `take +
 * skip` de cada tabla y se corta después. Con el volumen del centro —decenas de
 * fichas, no millones— eso es más barato que la alternativa, y es exacto.
 */
export async function listar(filtro: {
  q?: string;
  patientId?: string;
  careType?: TipoDeFicha;
  take: number;
  skip: number;
}) {
  const hasta = filtro.take + filtro.skip;
  const soloFaciales = filtro.careType === 'FACIAL';
  const soloCapilares = Boolean(filtro.careType) && !soloFaciales;

  const whereCapilar: Prisma.ClinicalRecordWhereInput = {
    ...(filtro.patientId ? { patientId: filtro.patientId } : {}),
    ...(soloCapilares ? { careType: filtro.careType as CareType } : {}),
    ...(condicionDeBusqueda(filtro.q).length
      ? { AND: condicionDeBusqueda(filtro.q) }
      : {}),
  };

  const whereFacial: Prisma.FacialRecordWhereInput = {
    ...(filtro.patientId ? { patientId: filtro.patientId } : {}),
    ...(condicionFacial(filtro.q).length ? { AND: condicionFacial(filtro.q) } : {}),
  };

  const [capilares, totalCapilar, faciales, totalFacial] = await Promise.all([
    soloFaciales
      ? []
      : prisma.clinicalRecord.findMany({
          where: whereCapilar,
          // Las firmas viven en las filas y pesan; el listado no las necesita.
          include: {
            patient: { select: { id: true, fullName: true } },
            _count: { select: { entries: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { procedureDate: 'desc' }, { id: 'desc' }],
          take: hasta,
        }),
    soloFaciales ? 0 : prisma.clinicalRecord.count({ where: whereCapilar }),
    soloCapilares
      ? []
      : prisma.facialRecord.findMany({
          where: whereFacial,
          include: {
            patient: { select: { id: true, fullName: true } },
            _count: { select: { entries: true } },
          },
          orderBy: [{ createdAt: 'desc' }, { openedAt: 'desc' }, { id: 'desc' }],
          take: hasta,
        }),
    soloCapilares ? 0 : prisma.facialRecord.count({ where: whereFacial }),
  ]);

  /**
   * Las dos tablas se traducen a una sola forma antes de mezclarlas. La ficha
   * facial guarda la fecha en `openedAt` y no tiene tipo de atención; acá pasa
   * a `procedureDate` y a un `careType` de «FACIAL», para que la pantalla no
   * tenga que saber de qué tabla vino cada fila.
   */
  const unificadas = [
    ...capilares.map((ficha) => ({
      id: ficha.id,
      procedureDate: ficha.procedureDate,
      createdAt: ficha.createdAt,
      patientName: ficha.patientName,
      patientDocument: ficha.patientDocument,
      patientPhone: ficha.patientPhone,
      careType: ficha.careType as TipoDeFicha,
      patient: ficha.patient,
      _count: ficha._count,
    })),
    ...faciales.map((ficha) => ({
      id: ficha.id,
      procedureDate: ficha.openedAt,
      createdAt: ficha.createdAt,
      patientName: ficha.patientName,
      patientDocument: ficha.patientDocument,
      patientPhone: ficha.patientPhone,
      careType: 'FACIAL' as TipoDeFicha,
      patient: ficha.patient,
      _count: ficha._count,
    })),
  ].sort((a, b) => {
    const porCreacion = b.createdAt.getTime() - a.createdAt.getTime();
    if (porCreacion !== 0) return porCreacion;
    const porFecha = b.procedureDate.getTime() - a.procedureDate.getTime();
    return porFecha !== 0 ? porFecha : b.id.localeCompare(a.id);
  });

  return {
    items: unificadas.slice(filtro.skip, hasta),
    total: totalCapilar + totalFacial,
    take: filtro.take,
    skip: filtro.skip,
  };
}

/**
 * Borrar una ficha clínica es destruir historia médica, así que solo ADMIN
 * puede y la ruta lo exige. Aquí no hay baja lógica porque, a diferencia de
 * una factura, no hay consecutivo que cuadrar: lo que protege el dato es el
 * permiso, no un estado.
 */
export async function eliminar(id: string) {
  await prisma.clinicalRecord.delete({ where: { id } });
}

/* -------------------------------------------------------------------------
 * Próximo control → cita en la agenda
 * ---------------------------------------------------------------------- */

/**
 * Combina la fecha del próximo control con su hora, en la zona de la clínica.
 *
 * La fecha se guarda a medianoche UTC; pegarle la hora sin más daría un
 * instante corrido cinco horas y una cita de las 3 de la tarde caería a las 10
 * de la mañana. `parseZonedDateTime` ya resuelve eso bien —y sin depender de
 * la zona en la que corra el servidor, que es donde fallan las versiones
 * caseras—, así que se reutiliza.
 */
function instanteEnLaClinica(fecha: Date, hora: string): Date | null {
  try {
    return parseZonedDateTime(fecha.toISOString().slice(0, 10), hora, env.CLINIC_TIMEZONE);
  } catch {
    return null;
  }
}

export interface AvisoAgenda {
  sesion: number;
  mensaje: string;
}

/**
 * Crea, mueve o cancela las citas de los próximos controles de una ficha.
 *
 * Devuelve avisos en vez de lanzar: la ficha clínica ya está guardada cuando
 * esto corre, y un choque de horarios en la agenda no puede hacer que se
 * pierda lo que el profesional acaba de escribir. La persona ve el aviso y
 * corrige la hora.
 */
export async function sincronizarProximosControles(recordId: string): Promise<AvisoAgenda[]> {
  const ficha = await prisma.clinicalRecord.findUnique({
    where: { id: recordId },
    include: {
      patient: true,
      entries: { orderBy: { sortOrder: 'asc' }, include: { nextControlAppointment: true } },
    },
  });
  if (!ficha) return [];

  const avisos: AvisoAgenda[] = [];

  for (const [indice, linea] of ficha.entries.entries()) {
    const sesion = indice + 1;
    const quiereCita = Boolean(linea.nextControl && linea.nextControlTime && linea.nextControlServiceId);
    const cita = linea.nextControlAppointment;

    // --- Ya no quiere cita: se cancela la que había ----------------------
    if (!quiereCita) {
      if (cita && cita.status !== AppointmentStatus.CANCELADA) {
        try {
          // Por el mismo camino que cualquier cancelación: borra el evento de
          // Google y ofrece la hora a quienes tienen cita más adelante.
          await citas.cancelarCita(cita.id, {
            motivo: 'Se quitó el próximo control de la ficha',
            origen: 'control',
          });
          await prisma.clinicalEntry.update({
            where: { id: linea.id },
            data: { nextControlAppointmentId: null },
          });
        } catch (error) {
          log.warn('No se pudo cancelar la cita del próximo control', error);
          avisos.push({ sesion, mensaje: 'No pudimos cancelar la cita anterior en la agenda.' });
        }
      }
      continue;
    }

    const inicio = instanteEnLaClinica(linea.nextControl!, linea.nextControlTime!);
    if (!inicio) {
      avisos.push({ sesion, mensaje: 'La hora del próximo control no es válida.' });
      continue;
    }

    /*
     * --- Ya existe: se mueve solo si cambió la hora ------------------------
     *
     * El tratamiento ya no cuenta: todas las citas son del mismo tipo y duran
     * lo mismo. Antes, cambiar de tratamiento cancelaba la cita y creaba otra;
     * ahora eso la haría cancelar y recrear en cada guardado, porque la cita
     * ya no lleva el tratamiento de la ficha.
     */
    if (cita && cita.status !== AppointmentStatus.CANCELADA) {
      if (cita.startsAt.getTime() === inicio.getTime()) continue;

      try {
        await citas.reschedule(cita.id, inicio, { desdeElPanel: true, origen: 'panel' });
      } catch (error) {
        log.warn('No se pudo mover la cita del próximo control', error);
        avisos.push({
          sesion,
          mensaje:
            error instanceof HttpError
              ? `No pudimos mover la cita: ${error.message}`
              : 'No pudimos mover la cita en la agenda.',
        });
      }
      continue;
    }

    // --- Crear ------------------------------------------------------------
    try {
      const reserva = await citas.createBooking({
        contactName: ficha.patientName,
        contactPhone: ficha.patientPhone ?? ficha.patient.phone,
        patientId: ficha.patientId,
        startsAt: inicio,
        source: AppointmentSource.PRESENCIAL,
        message: `Próximo control · ficha del ${ficha.procedureDate.toISOString().slice(0, 10)}`,
        desdeElPanel: true,
      });

      await prisma.clinicalEntry.update({
        where: { id: linea.id },
        data: { nextControlAppointmentId: reserva.appointment.id },
      });
    } catch (error) {
      log.warn('No se pudo agendar el próximo control', error);
      avisos.push({
        sesion,
        mensaje:
          error instanceof HttpError
            ? `No pudimos agendar el próximo control: ${error.message}`
            : 'No pudimos agendar el próximo control.',
      });
    }
  }

  return avisos;
}
