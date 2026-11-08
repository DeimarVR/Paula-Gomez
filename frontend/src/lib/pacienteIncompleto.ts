/**
 * Qué le falta a una ficha de paciente para estar completa.
 *
 * Nace de la carga de las hojas de papel: varias venían sin teléfono y una sin
 * cédula, y aun así había que subirlas —un paciente atendido existe, con o sin
 * el papel bien llenado—. Sin una marca visible, esos huecos se pierden entre
 * cientos de pacientes y nadie los completa nunca.
 *
 * NO es una columna en la base, y eso es a propósito. Se calcula mirando los
 * datos que ya están, así que la marca desaparece sola en cuanto alguien
 * escribe el teléfono que faltaba. Una casilla «incompleto» de verdad habría
 * que acordarse de desmarcarla, y una marca que hay que apagar a mano termina
 * mintiendo: seguiría encendida en pacientes ya corregidos y apagada en los que
 * alguien vació después.
 *
 * Tampoco necesita migración: no hay nada que agregarle a la base, así que esto
 * funciona desde el momento en que se despliega.
 */

export interface DatosPaciente {
  documentId?: string | null;
  phone?: string | null;
  email?: string | null;
}

/**
 * Solo cédula y teléfono.
 *
 * El correo no entra: la mayoría de los pacientes del centro no lo dan, y
 * marcar como incompleto a casi todo el mundo haría que la señal no signifique
 * nada. Se marca lo que de verdad hace falta para atender y para avisar.
 */
export function datosQueFaltan(paciente: DatosPaciente): string[] {
  const faltan: string[] = [];
  if (!paciente.documentId || !paciente.documentId.trim()) faltan.push('cédula');
  // El teléfono es obligatorio en la base, así que un paciente sin él llega con
  // la cadena vacía, no con null. Se comprueban los dos casos.
  if (!paciente.phone || !paciente.phone.trim()) faltan.push('teléfono');
  return faltan;
}

export function estaIncompleto(paciente: DatosPaciente): boolean {
  return datosQueFaltan(paciente).length > 0;
}

/** «Falta el teléfono» · «Faltan la cédula y el teléfono». */
export function textoDeLoQueFalta(paciente: DatosPaciente): string | null {
  const faltan = datosQueFaltan(paciente);
  if (faltan.length === 0) return null;
  const articulo = (campo: string) => (campo === 'cédula' ? 'la cédula' : 'el teléfono');
  return faltan.length === 1
    ? `Falta ${articulo(faltan[0])}`
    : `Faltan ${faltan.map(articulo).join(' y ')}`;
}
