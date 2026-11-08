import { prisma } from '../../lib/prisma';
import { HttpError } from '../../lib/httpError';
import { construirClave, guardarObjeto } from '../../storage';
import { armarPdf } from './documento';

/**
 * Consentimientos informados.
 *
 * Dos cosas distintas que conviene no confundir:
 *
 *   PLANTILLA  el texto que redactó el centro. Se corrige, se versiona y se
 *              archiva.
 *   FIRMADO    lo que un paciente concreto firmó un día concreto. Es un
 *              documento CERRADO: se genera una vez y no se toca nunca más.
 *
 * La distinción es el corazón del módulo. Si el firmado fuera solo «plantilla X
 * + firma de Fulano», corregir mañana el texto cambiaría retroactivamente lo
 * que Fulano aceptó, y eso no es un consentimiento: es un papel en blanco con
 * una firma. Por eso al firmar se produce un PDF propio y se congelan dentro
 * los datos del paciente y la versión del texto.
 *
 * La plantilla es TEXTO, no un PDF subido. Antes era un archivo que cargaba el
 * centro y sobre el que se pegaba la firma, y era un pozo de fallos: los PDF
 * que salen de plataformas de firma vienen cifrados y la librería ni los abre,
 * los escaneados pesan de más, los que traen fuentes raras revientan al
 * guardarse. Todo eso aparecía con el paciente delante y el documento ya leído.
 * Con el texto en la base de datos no hay archivo ajeno que pueda estar mal.
 */

/* ------------------------------------------------------------------ *
 * Plantillas
 * ------------------------------------------------------------------ */

export interface PlantillaEntrada {
  name: string;
  description?: string | null;
  /** El consentimiento en sí. Párrafos separados por saltos de línea. */
  body: string;
  serviceIds: string[];
  active?: boolean;
}

export function listarPlantillas(incluirInactivas = false) {
  return prisma.consentTemplate.findMany({
    where: incluirInactivas ? {} : { active: true },
    include: {
      services: { select: { id: true, name: true } },
      _count: { select: { signatures: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export function crearPlantilla(datos: PlantillaEntrada, createdById?: string) {
  return prisma.consentTemplate.create({
    data: {
      name: datos.name.trim(),
      description: datos.description?.trim() || null,
      body: datos.body.trim(),
      createdById: createdById ?? null,
      services: { connect: datos.serviceIds.map((id) => ({ id })) },
    },
    include: { services: { select: { id: true, name: true } } },
  });
}

export async function actualizarPlantilla(id: string, datos: PlantillaEntrada) {
  const existente = await prisma.consentTemplate.findUnique({
    where: { id },
    select: { id: true, body: true, version: true },
  });
  if (!existente) throw HttpError.notFound('Plantilla no encontrada');

  const cuerpo = datos.body.trim();

  /**
   * Cambiar el texto sube la versión.
   *
   * Es lo que permite responder «qué versión firmó este paciente» cuando el
   * consentimiento se corrige a mitad de año. Cambiar el nombre, la
   * descripción o a qué tratamientos aplica no cuenta: el documento que se
   * firma no cambió.
   */
  const textoNuevo = cuerpo !== existente.body;

  return prisma.consentTemplate.update({
    where: { id },
    data: {
      name: datos.name.trim(),
      description: datos.description?.trim() || null,
      body: cuerpo,
      ...(textoNuevo ? { version: existente.version + 1 } : {}),
      ...(datos.active === undefined ? {} : { active: datos.active }),
      services: { set: datos.serviceIds.map((id) => ({ id })) },
    },
    include: { services: { select: { id: true, name: true } } },
  });
}

/**
 * Archiva la plantilla: deja de ofrecerse al firmar, pero sigue existiendo.
 *
 * Archivar es lo único que se hace desde la lista, tenga firmas o no. Antes
 * este mismo botón borraba cuando nadie había firmado y archivaba cuando sí,
 * así que la misma acción tenía dos finales distintos según un dato que no
 * estaba a la vista. Un solo concepto se explica solo.
 */
export async function archivarPlantilla(id: string) {
  await prisma.consentTemplate.update({ where: { id }, data: { active: false } });
  return { archivado: true };
}

export async function reactivarPlantilla(id: string) {
  await prisma.consentTemplate.update({ where: { id }, data: { active: true } });
  return { archivado: false };
}

/**
 * Borra la plantilla de verdad. Solo desde la vista de archivados.
 *
 * Se pide estar archivada primero a propósito: obliga a dos pasos separados en
 * el tiempo para algo que no tiene vuelta, y el segundo se da mirando una lista
 * de cosas que ya se quería limpiar, no en medio del trabajo del día.
 *
 * Lo que los pacientes firmaron NO se toca: cada firmado guarda su propio PDF y
 * su copia del nombre y la versión, y la relación es `onDelete: SetNull`. Lo
 * que se pierde es el texto de la plantilla y poder agrupar los firmados por
 * ella; por eso se avisa de cuántas firmas quedan sueltas.
 */
export async function eliminarPlantilla(id: string) {
  const plantilla = await prisma.consentTemplate.findUnique({
    where: { id },
    select: { id: true, active: true },
  });
  if (!plantilla) throw HttpError.notFound('Plantilla no encontrada');
  if (plantilla.active) {
    throw HttpError.unprocessable('Archiva el consentimiento antes de borrarlo.');
  }

  const firmas = await prisma.signedConsent.count({ where: { templateId: id } });
  await prisma.consentTemplate.delete({ where: { id } });
  return { borrado: true, firmas };
}

/* ------------------------------------------------------------------ *
 * Firma
 * ------------------------------------------------------------------ */

export interface FirmaEntrada {
  templateId: string;
  patientId: string;
  /** PNG en data URL, tal cual sale del pad de firma. */
  signature: string;
  signedAt: Date;
  professionalName?: string | null;
  notes?: string | null;
}

export async function firmar(datos: FirmaEntrada, usuarioId?: string) {
  const [plantilla, paciente] = await Promise.all([
    prisma.consentTemplate.findUnique({ where: { id: datos.templateId } }),
    prisma.patient.findUnique({
      where: { id: datos.patientId },
      select: { id: true, fullName: true, documentId: true },
    }),
  ]);

  if (!plantilla) throw HttpError.notFound('Consentimiento no encontrado');
  if (!plantilla.active) throw HttpError.unprocessable('Ese consentimiento está archivado.');
  if (!plantilla.body.trim()) {
    throw HttpError.unprocessable('Ese consentimiento no tiene texto. Escríbelo antes de firmar.');
  }
  if (!paciente) throw HttpError.notFound('Paciente no encontrado');

  const coincide = /^data:image\/png;base64,(.+)$/.exec(datos.signature.trim());
  if (!coincide) throw HttpError.unprocessable('La firma no llegó en el formato esperado.');

  const firmaPng = Buffer.from(coincide[1], 'base64');

  let pdfFirmado: Uint8Array;
  try {
    pdfFirmado = await armarPdf({
      templateName: plantilla.name,
      version: plantilla.version,
      body: plantilla.body,
      patientName: paciente.fullName,
      patientDocument: paciente.documentId,
      professionalName: datos.professionalName ?? null,
      signedAt: datos.signedAt,
      signaturePng: firmaPng,
      notes: datos.notes ?? null,
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    /**
     * Ya no hay archivo ajeno que pueda venir mal, así que si esto falla es un
     * fallo nuestro y el mensaje genérico de antes solo mandaba a revisar algo
     * que no era. Se deja el detalle real: es información para arreglarlo, no
     * una instrucción imposible para quien está en el mostrador.
     */
    const detalle = error instanceof Error ? error.message : String(error);
    throw HttpError.unprocessable(`No pudimos armar el PDF del consentimiento (${detalle}).`);
  }

  const clave = construirClave('consentimientos', 'application/pdf');
  const fileUrl = await guardarObjeto(clave, pdfFirmado, 'application/pdf');

  return prisma.signedConsent.create({
    data: {
      templateId: plantilla.id,
      patientId: paciente.id,
      // Congelados: lo firmado no puede cambiar porque cambie el catálogo.
      templateName: plantilla.name,
      templateVersion: plantilla.version,
      patientName: paciente.fullName,
      patientDocument: paciente.documentId,
      signedAt: datos.signedAt,
      fileUrl,
      signature: datos.signature,
      professionalName: datos.professionalName ?? null,
      signedById: usuarioId ?? null,
      notes: datos.notes ?? null,
    },
    include: { patient: { select: { id: true, fullName: true } } },
  });
}

export function listarFirmados(params: { patientId?: string; take?: number } = {}) {
  return prisma.signedConsent.findMany({
    where: params.patientId ? { patientId: params.patientId } : {},
    include: {
      patient: { select: { id: true, fullName: true } },
      signedBy: { select: { fullName: true } },
    },
    orderBy: { signedAt: 'desc' },
    take: params.take ?? 100,
  });
}
