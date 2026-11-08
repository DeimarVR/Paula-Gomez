/**
 * El texto de los mensajes de cita, en un solo sitio.
 *
 * Lo escriben dos partes distintas del sistema: el servidor cuando el envío
 * automático está activo, y el panel cuando hay que mandarlo a mano por un
 * enlace de wa.me. Si cada una tuviera su propia versión, el día que se
 * corrigiera una frase el paciente recibiría un texto u otro según por dónde
 * hubiera salido, y nadie se enteraría.
 *
 * La redacción es la que ya usaba el centro por WhatsApp, palabra por palabra:
 * trato de usted, sede completa y despedida formal. No se «mejoró» al pasarla
 * aquí a propósito — un paciente que recibió el mensaje escrito a mano el mes
 * pasado y el automático este mes tiene que reconocer el mismo remitente.
 *
 * Por eso son funciones puras: reciben los datos ya resueltos —el nombre del
 * centro, la sede, la fecha ya escrita— en vez de leerlos, porque el servidor
 * los saca de las variables de entorno y el navegador de la configuración.
 */

export interface DatosMensajeCita {
  centro: string;
  /** La sede completa, tal como la dicta el centro por teléfono. */
  sede: string;
  /** «viernes 11 de septiembre a las 6:30 pm». Sin año: así lo escriben ellos. */
  cuando: string;
  /** El WhatsApp de contacto, en grupos de tres: «300 123 4567». */
  whatsapp: string;
}

export function textoConfirmacionCita(datos: DatosMensajeCita): string {
  return [
    `Estimada/o paciente.`,
    ``,
    `Le confirmamos su cita en ${datos.centro}. La cita tendrá lugar en nuestra sede ubicada en ${datos.sede}.`,
    ``,
    `El día ${datos.cuando}.`,
    ``,
    `En caso de que necesite reprogramar o cancelar su cita, por favor comuníquese con nosotros al WhatsApp ${datos.whatsapp}.`,
    ``,
    `Agradecemos su confianza en nuestros servicios y esperamos su visita.`,
    ``,
    `Saludos cordiales,`,
    datos.centro,
  ].join('\n');
}

export interface DatosRecordatorioCita {
  centro: string;
  /** Solo la hora: «7:30pm». El día no va, porque el texto dice «mañana». */
  hora: string;
  /** La sede completa, tal como la dicta el centro por teléfono. */
  sede: string;
  /** El WhatsApp de contacto, en grupos de tres: «300 123 4567». */
  whatsapp: string;
}

/**
 * El mensaje de la víspera: recuerda la cita, dice dónde es y PIDE respuesta.
 *
 * Antes esto eran dos mensajes. El primero preguntaba si venía y el segundo,
 * cuando contestaba, traía la dirección y el teléfono. En el papel tenía
 * sentido; en el mostrador significaba abrir WhatsApp dos veces por paciente,
 * y con quince citas al día eso son treinta envíos a mano. Ahora va todo en
 * uno: el paciente tiene la dirección desde el primer mensaje y sigue habiendo
 * un solo sí o no que esperar.
 *
 * Sigue terminando con una pregunta a propósito. Lo que hace falta de vuelta es
 * saber si viene —esa hora se le puede ofrecer a alguien más— y un mensaje que
 * solo informa no lo consigue.
 *
 * Dice «mañana» y no la fecha porque siempre sale la víspera: tanto la tarea
 * automática como la pantalla de recordatorios trabajan sobre las citas del día
 * siguiente. Si algún día se mandara con más antelación, esta frase deja de ser
 * cierta y hay que cambiarla.
 *
 * Los asteriscos alrededor de la hora son de WhatsApp: la ponen en negrita, que
 * es el dato que el paciente tiene que ver de un vistazo. Van a propósito.
 */
export function textoRecordatorioCita(datos: DatosRecordatorioCita): string {
  return [
    `Estimado/a paciente,`,
    ``,
    `Reciba un cordial saludo de parte ${datos.centro}. Le recordamos amablemente su cita programada para el día de mañana a las *${datos.hora}*, en nuestra sede ubicada en ${datos.sede}.`,
    ``,
    `Agradecemos confirmar si podrá asistir a la cita o, en caso de no ser posible, informarnos si desea reagendarla al WhatsApp ${datos.whatsapp}.`,
    ``,
    `Quedamos atentos a su confirmación.`,
    ``,
    `Cordialmente,`,
    `${datos.centro}.`,
  ].join('\n');
}

export interface DatosOfertaHueco {
  centro: string;
  /** El horario que se liberó, en palabras: «martes 10 de noviembre a las 9:15 am». */
  nuevo: string;
  /** La cita que tiene ahora la persona, en las mismas palabras. */
  actual: string;
  /** El enlace personal /oferta/<token>. */
  enlace: string;
}

/**
 * «Se liberó un espacio, ¿quiere adelantar su cita?».
 *
 * Dice las dos fechas porque es lo que la persona necesita para decidir sin
 * abrir nada: cuándo es lo que se le ofrece y cuándo es lo que ya tiene. Y
 * deja claro que no contestar no le cuesta nada —su cita se mantiene—, para
 * que nadie sienta que perdió algo por no ver el mensaje a tiempo.
 */
export function textoOfertaHueco(datos: DatosOfertaHueco): string {
  return [
    `Estimado/a paciente,`,
    ``,
    `Reciba un cordial saludo de parte de ${datos.centro}. Se liberó un espacio en la agenda el *${datos.nuevo}* y, como usted tiene cita el ${datos.actual}, queremos ofrecérselo por si desea adelantarla.`,
    ``,
    `Si le sirve, puede tomarlo aquí: ${datos.enlace}`,
    ``,
    `El espacio queda para la primera persona que lo tome. Si no le interesa, no tiene que hacer nada: su cita actual se mantiene.`,
    ``,
    `Cordialmente,`,
    `${datos.centro}.`,
  ].join('\n');
}

export interface DatosDiaCerrado {
  centro: string;
  /** Quien firma la disculpa: la especialista. */
  especialista: string;
  /** La cita que se canceló, en palabras. */
  cuando: string;
  /** Lo que se escribió al cerrar el día. Opcional: no siempre se quiere contar. */
  motivo?: string | null;
  /** El enlace de la cita, donde ahora puede elegir otro horario. */
  enlace: string;
  /** El WhatsApp de contacto, en grupos de tres. */
  whatsapp: string;
}

/**
 * La disculpa cuando la especialista cierra un día con citas.
 *
 * Va a su nombre porque es ella quien falla al compromiso, no «el sistema».
 * Lo primero que se lee es la disculpa; lo segundo, qué puede hacer la persona
 * —elegir otra hora con un toque—. Si prefiere hablar con alguien, el
 * WhatsApp va al final.
 */
export function textoDiaCerrado(datos: DatosDiaCerrado): string {
  return [
    `Estimado/a paciente,`,
    ``,
    `${datos.especialista} le ofrece sus disculpas: no podrá atender su cita del ${datos.cuando}, que quedó cancelada.`,
    // Sin el punto final que haya escrito quien cerró el día: aquí se pone uno.
    ...(datos.motivo?.trim() ? [``, `Motivo: ${datos.motivo.trim().replace(/[.\s]+$/, '')}.`] : []),
    ``,
    `Puede elegir un nuevo horario aquí, cuando le quede bien: ${datos.enlace}`,
    ``,
    `Si prefiere que le ayudemos a reagendar, escríbanos al WhatsApp ${datos.whatsapp}.`,
    ``,
    `Cordialmente,`,
    `${datos.centro}.`,
  ].join('\n');
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

const DIAS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

/**
 * «viernes 11 de septiembre a las 6:30 pm», que es como lo escribe el centro.
 *
 * Se arma a mano y no con `toLocaleString` porque ningún formato de `Intl`
 * da exactamente esto: los de es-CO meten el año, ponen coma tras el día y
 * escriben «6:30 p. m.» con puntos y espacios. Aquí la forma del texto no es un
 * detalle estético — es la firma del centro, y el paciente la reconoce.
 *
 * `zonaHoraria` es obligatoria: sin ella, el servidor —que corre en UTC—
 * escribiría una cita de las 6:30 pm en la zona de la clínica como las 11:30 pm.
 */
export function fechaEnPalabras(fecha: Date | string, zonaHoraria: string): string {
  const valor = typeof fecha === 'string' ? new Date(fecha) : fecha;

  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zonaHoraria,
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(valor);

  const dato = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? '';

  const diaSemana = DIAS[new Date(valor.toLocaleString('en-US', { timeZone: zonaHoraria })).getDay()];
  const dia = Number(dato('day'));
  const mes = MESES[Number(dato('month')) - 1];

  // `hour12: false` da 00–23; de ahí salen las 12 horas y el am/pm.
  const hora24 = Number(dato('hour')) % 24;
  const minuto = dato('minute');
  const sufijo = hora24 < 12 ? 'am' : 'pm';
  const hora12 = hora24 % 12 === 0 ? 12 : hora24 % 12;

  return `${diaSemana} ${dia} de ${mes} a las ${hora12}:${minuto} ${sufijo}`;
}

/**
 * «7:30pm», la hora sola, pegada y en minúscula.
 *
 * Es la forma que usa el recordatorio, y no coincide con ninguna de `Intl`:
 * es-CO escribe «7:30 p. m.», con espacios y puntos. Sale de la misma cuenta
 * que `fechaEnPalabras` para que las dos no puedan discrepar.
 */
export function horaEnPalabras(fecha: Date | string, zonaHoraria: string): string {
  const completa = fechaEnPalabras(fecha, zonaHoraria);
  const [, hora] = completa.split(' a las ');
  // «6:30 pm» -> «6:30pm».
  return (hora ?? '').replace(' ', '');
}

/** «573001234567» → «300 123 4567», como se escribe en el mensaje. */
export function whatsappEnPalabras(numero: string): string {
  const digitos = String(numero ?? '').replace(/\D/g, '');
  const local = digitos.startsWith('57') && digitos.length === 12 ? digitos.slice(2) : digitos;

  return local.length === 10
    ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`
    : local || '—';
}
