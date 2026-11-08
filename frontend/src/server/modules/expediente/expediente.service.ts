import { AppointmentStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import { createLogger } from '../../lib/logger';
import { borrarObjeto, claveDesdeRuta } from '../../storage';
import type { AuthPayload } from '../../http';

const log = createLogger('expediente');

/**
 * El expediente general del paciente.
 *
 * Cinco cosas, que son las que la especialista quiere tener a la vista al
 * abrir a alguien: qué se le está tratando, qué está tomando, sus antecedentes
 * y alergias, cómo ha ido (notas de evolución) y las hojas que se llenaron a
 * mano en consulta, fotografiadas.
 *
 * Reemplaza a las fichas capilar y facial, que eran del centro anterior y
 * quedan apagadas en `FUNCIONES` sin borrar su código.
 */

const ACTIVAS: AppointmentStatus[] = [AppointmentStatus.PENDIENTE, AppointmentStatus.CONFIRMADA];

async function existePaciente(patientId: string) {
  const paciente = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
  if (!paciente) throw HttpError.notFound('Paciente no encontrado');
}

/** Deja escrito quién tocó el expediente y cuándo. */
function sello(usuario: AuthPayload) {
  return { clinicalUpdatedAt: new Date(), clinicalUpdatedBy: usuario.fullName };
}

export async function leerExpediente(patientId: string) {
  const paciente = await prisma.patient.findUnique({
    where: { id: patientId },
    include: {
      medications: { orderBy: [{ active: 'desc' }, { createdAt: 'desc' }] },
      evolutionNotes: { orderBy: [{ noteDate: 'desc' }, { createdAt: 'desc' }] },
      paperSheets: { orderBy: [{ sheetDate: 'desc' }, { createdAt: 'desc' }] },
    },
  });
  if (!paciente) throw HttpError.notFound('Paciente no encontrado');

  const ahora = new Date();
  const [proximaCita, controlesHechos, primeraCita] = await Promise.all([
    prisma.appointment.findFirst({
      where: { patientId, status: { in: ACTIVAS }, startsAt: { gte: ahora } },
      orderBy: { startsAt: 'asc' },
      select: { id: true, startsAt: true, status: true },
    }),
    // Los controles del plan actual: citas atendidas desde que se fijó el plan.
    paciente.plannedControls && paciente.controlsSince
      ? prisma.appointment.count({
          where: {
            patientId,
            status: AppointmentStatus.COMPLETADA,
            startsAt: { gte: paciente.controlsSince },
          },
        })
      : Promise.resolve(null),
    prisma.appointment.findFirst({
      where: { patientId, status: AppointmentStatus.COMPLETADA },
      orderBy: { startsAt: 'asc' },
      select: { startsAt: true },
    }),
  ]);

  return {
    tratamiento: {
      motivo: paciente.consultReason,
      diagnostico: paciente.diagnosis,
      plan: paciente.carePlan,
      controlesPrevistos: paciente.plannedControls,
      controlesHechos,
    },
    antecedentes: {
      alergias: paciente.allergies,
      personales: paciente.medicalNotes,
      quirurgicos: paciente.surgicalHistory,
      familiares: paciente.familyHistory,
    },
    medicamentos: paciente.medications,
    notas: paciente.evolutionNotes,
    hojas: paciente.paperSheets,
    actualizado: paciente.clinicalUpdatedAt
      ? { en: paciente.clinicalUpdatedAt, por: paciente.clinicalUpdatedBy }
      : null,
    proximaCita,
    primeraAtencion: primeraCita?.startsAt ?? null,
  };
}

export interface DatosTratamiento {
  motivo?: string | null;
  diagnostico?: string | null;
  plan?: string | null;
  controlesPrevistos?: number | null;
}

export async function guardarTratamiento(
  patientId: string,
  datos: DatosTratamiento,
  usuario: AuthPayload,
) {
  const antes = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { plannedControls: true },
  });
  if (!antes) throw HttpError.notFound('Paciente no encontrado');

  /*
   * Cambiar el número de controles es empezar a contar de nuevo. Si no, un
   * plan de 4 controles puesto hoy aparecería con los 6 que se hicieron del
   * plan anterior y la barra saldría llena el primer día.
   */
  const cambiaElConteo =
    datos.controlesPrevistos !== undefined && datos.controlesPrevistos !== antes.plannedControls;

  await prisma.patient.update({
    where: { id: patientId },
    data: {
      ...(datos.motivo !== undefined ? { consultReason: datos.motivo || null } : {}),
      ...(datos.diagnostico !== undefined ? { diagnosis: datos.diagnostico || null } : {}),
      ...(datos.plan !== undefined ? { carePlan: datos.plan || null } : {}),
      ...(cambiaElConteo
        ? {
            plannedControls: datos.controlesPrevistos || null,
            controlsSince: datos.controlesPrevistos ? new Date() : null,
          }
        : {}),
      ...sello(usuario),
    },
  });
  return leerExpediente(patientId);
}

export interface DatosAntecedentes {
  alergias?: string | null;
  personales?: string | null;
  quirurgicos?: string | null;
  familiares?: string | null;
}

export async function guardarAntecedentes(
  patientId: string,
  datos: DatosAntecedentes,
  usuario: AuthPayload,
) {
  await existePaciente(patientId);
  await prisma.patient.update({
    where: { id: patientId },
    data: {
      ...(datos.alergias !== undefined ? { allergies: datos.alergias || null } : {}),
      ...(datos.personales !== undefined ? { medicalNotes: datos.personales || null } : {}),
      ...(datos.quirurgicos !== undefined ? { surgicalHistory: datos.quirurgicos || null } : {}),
      ...(datos.familiares !== undefined ? { familyHistory: datos.familiares || null } : {}),
      ...sello(usuario),
    },
  });
  return leerExpediente(patientId);
}

/* --- Medicación ---------------------------------------------------------- */

export interface DatosMedicamento {
  nombre: string;
  dosis?: string | null;
  notas?: string | null;
  desde?: Date | null;
}

export async function agregarMedicamento(
  patientId: string,
  datos: DatosMedicamento,
  usuario: AuthPayload,
) {
  await existePaciente(patientId);
  const [medicamento] = await prisma.$transaction([
    prisma.patientMedication.create({
      data: {
        patientId,
        name: datos.nombre.trim(),
        dose: datos.dosis?.trim() || null,
        notes: datos.notas?.trim() || null,
        startedOn: datos.desde ?? new Date(),
        createdBy: usuario.fullName,
      },
    }),
    prisma.patient.update({ where: { id: patientId }, data: sello(usuario) }),
  ]);
  return medicamento;
}

export async function editarMedicamento(
  id: string,
  datos: Partial<DatosMedicamento> & { activo?: boolean },
  usuario: AuthPayload,
) {
  const actual = await prisma.patientMedication.findUnique({ where: { id } });
  if (!actual) throw HttpError.notFound('Medicamento no encontrado');

  /*
   * Suspender guarda el día en que se dejó; reactivarlo lo limpia. Así la
   * lista de «lo que toma hoy» es la de los activos, y la historia conserva
   * hasta cuándo tomó cada cosa.
   */
  const cambioDeEstado =
    datos.activo === undefined || datos.activo === actual.active
      ? {}
      : { active: datos.activo, endedOn: datos.activo ? null : new Date() };

  const [medicamento] = await prisma.$transaction([
    prisma.patientMedication.update({
      where: { id },
      data: {
        ...(datos.nombre !== undefined ? { name: datos.nombre.trim() } : {}),
        ...(datos.dosis !== undefined ? { dose: datos.dosis?.trim() || null } : {}),
        ...(datos.notas !== undefined ? { notes: datos.notas?.trim() || null } : {}),
        ...(datos.desde !== undefined ? { startedOn: datos.desde } : {}),
        ...cambioDeEstado,
      },
    }),
    prisma.patient.update({ where: { id: actual.patientId }, data: sello(usuario) }),
  ]);
  return medicamento;
}

/** Borrar es para lo que se anotó por error. Lo que dejó de tomar se suspende. */
export async function borrarMedicamento(id: string) {
  const actual = await prisma.patientMedication.findUnique({ where: { id } });
  if (!actual) throw HttpError.notFound('Medicamento no encontrado');
  await prisma.patientMedication.delete({ where: { id } });
  return { id };
}

/* --- Notas de evolución -------------------------------------------------- */

export async function agregarNota(
  patientId: string,
  datos: { texto: string; fecha?: Date | null },
  usuario: AuthPayload,
) {
  await existePaciente(patientId);
  const [nota] = await prisma.$transaction([
    prisma.evolutionNote.create({
      data: {
        patientId,
        body: datos.texto.trim(),
        noteDate: datos.fecha ?? new Date(),
        authorId: usuario.sub,
        authorName: usuario.fullName,
      },
    }),
    prisma.patient.update({ where: { id: patientId }, data: sello(usuario) }),
  ]);
  return nota;
}

/**
 * Corregir una nota.
 *
 * Solo quien la escribió, o administración. Una nota clínica firmada por una
 * persona no la reescribe otra: si hay algo que añadir, se escribe una nota
 * nueva.
 */
export async function editarNota(
  id: string,
  datos: { texto?: string; fecha?: Date | null },
  usuario: AuthPayload,
) {
  const nota = await prisma.evolutionNote.findUnique({ where: { id } });
  if (!nota) throw HttpError.notFound('Nota no encontrada');
  if (nota.authorId !== usuario.sub && usuario.role !== 'ADMIN') {
    throw HttpError.forbidden('Solo quien escribió la nota puede corregirla.');
  }
  return prisma.evolutionNote.update({
    where: { id },
    data: {
      ...(datos.texto !== undefined ? { body: datos.texto.trim() } : {}),
      ...(datos.fecha ? { noteDate: datos.fecha } : {}),
    },
  });
}

export async function borrarNota(id: string, usuario: AuthPayload) {
  const nota = await prisma.evolutionNote.findUnique({ where: { id } });
  if (!nota) throw HttpError.notFound('Nota no encontrada');
  if (nota.authorId !== usuario.sub && usuario.role !== 'ADMIN') {
    throw HttpError.forbidden('Solo quien escribió la nota puede borrarla.');
  }
  await prisma.evolutionNote.delete({ where: { id } });
  return { id };
}

/* --- Historial en papel -------------------------------------------------- */

export interface DatosHoja {
  titulo: string;
  fecha?: Date | null;
  ruta: string;
  tipo: string;
  notas?: string | null;
}

/**
 * Guarda una o varias hojas ya subidas al bucket.
 *
 * La subida la hace el navegador con una URL firmada (`/api/uploads`, carpeta
 * `expedientes`); aquí solo se registra. Se exige que la ruta sea de esa
 * carpeta: si no, alguien podría colgar en el expediente una foto de la
 * galería pública o de otro sitio.
 */
export async function agregarHojas(patientId: string, hojas: DatosHoja[], usuario: AuthPayload) {
  await existePaciente(patientId);
  for (const hoja of hojas) {
    if (!claveDesdeRuta(hoja.ruta)?.startsWith('expedientes/')) {
      throw HttpError.badRequest('La hoja tiene que subirse a la carpeta del expediente.');
    }
  }

  const creadas = await prisma.$transaction([
    ...hojas.map((hoja) =>
      prisma.paperSheet.create({
        data: {
          patientId,
          title: hoja.titulo.trim(),
          sheetDate: hoja.fecha ?? null,
          fileUrl: hoja.ruta,
          mimeType: hoja.tipo,
          notes: hoja.notas?.trim() || null,
          uploadedBy: usuario.fullName,
        },
      }),
    ),
    prisma.patient.update({ where: { id: patientId }, data: sello(usuario) }),
  ]);
  return creadas.slice(0, hojas.length);
}

export async function editarHoja(
  id: string,
  datos: { titulo?: string; fecha?: Date | null; notas?: string | null },
) {
  const hoja = await prisma.paperSheet.findUnique({ where: { id } });
  if (!hoja) throw HttpError.notFound('Hoja no encontrada');
  return prisma.paperSheet.update({
    where: { id },
    data: {
      ...(datos.titulo !== undefined ? { title: datos.titulo.trim() } : {}),
      ...(datos.fecha !== undefined ? { sheetDate: datos.fecha } : {}),
      ...(datos.notas !== undefined ? { notes: datos.notas?.trim() || null } : {}),
    },
  });
}

/**
 * Borra la hoja y su archivo.
 *
 * Primero la fila y después el archivo: si el bucket falla, queda un archivo
 * huérfano que nadie ve —molesto, no grave—; al revés quedaría una hoja en el
 * expediente apuntando a la nada.
 */
export async function borrarHoja(id: string) {
  const hoja = await prisma.paperSheet.findUnique({ where: { id } });
  if (!hoja) throw HttpError.notFound('Hoja no encontrada');
  await prisma.paperSheet.delete({ where: { id } });

  const clave = claveDesdeRuta(hoja.fileUrl);
  if (clave) {
    await borrarObjeto(clave).catch((error) => log.warn('No se pudo borrar el archivo', error));
  }
  return { id };
}
