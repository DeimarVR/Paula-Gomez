import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Datos iniciales: usuario administrador, horario de atención y un catálogo
 * de tratamientos neutro para que la portada no arranque vacía.
 *
 * Es idempotente: se puede volver a ejecutar sin duplicar nada.
 */

/*
 * Catálogo de arranque, neutro: lo que hace casi cualquier especialista. Se
 * edita o se reemplaza desde el panel (Tratamientos) cuando se conozca la
 * especialidad. La duración es la de la única cita del consultorio.
 *
 * Testimonios no se siembran: los que salgan en la web tienen que ser de
 * pacientes reales que dieron su permiso, y se agregan desde el panel. Sin
 * ninguno, la sección simplemente no aparece.
 */
const SERVICES = [
  {
    slug: 'valoracion',
    name: 'Valoración médica',
    shortDesc: 'Revisión completa de su caso y un plan claro, por escrito.',
    description:
      'La primera consulta. Escuchamos su historia, revisamos antecedentes, exámenes y la medicación que toma, y salimos con un plan concreto: qué hacer, cada cuánto y qué esperar.',
    durationMin: 75,
    priceCop: null,
    sessionsAdvice: 1,
    category: 'General',
    icon: 'microscope',
    benefits: ['Historia clínica completa', 'Plan de tratamiento por escrito', 'Tiempo para resolver dudas'],
    featured: true,
    sortOrder: 0,
  },
  {
    slug: 'tratamientos',
    name: 'Tratamientos personalizados',
    shortDesc: 'Protocolos ajustados a su valoración, con fechas desde el inicio.',
    description:
      'Cada tratamiento parte de su valoración. Sabrá desde el primer día cuántas sesiones o controles necesita y cuándo, y todo queda registrado en su expediente.',
    durationMin: 75,
    priceCop: null,
    sessionsAdvice: null,
    category: 'General',
    icon: 'sparkles',
    benefits: ['Plan con fechas desde el inicio', 'Seguimiento en cada cita', 'Ajustes según su evolución'],
    featured: true,
    sortOrder: 1,
  },
  {
    slug: 'procedimientos',
    name: 'Procedimientos en consultorio',
    shortDesc: 'Con consentimiento firmado e indicaciones antes y después.',
    description:
      'Los procedimientos se hacen en el consultorio, con su consentimiento informado firmado y las indicaciones de cuidado por escrito.',
    durationMin: 75,
    priceCop: null,
    sessionsAdvice: null,
    category: 'General',
    icon: 'syringe',
    benefits: ['Consentimiento informado', 'Indicaciones por escrito', 'Control posterior'],
    featured: false,
    sortOrder: 2,
  },
  {
    slug: 'controles',
    name: 'Controles de seguimiento',
    shortDesc: 'Revisamos su evolución y ajustamos lo que haga falta.',
    description:
      'En cada control comparamos con la cita anterior, revisamos cómo le ha ido con el tratamiento y la medicación, y dejamos agendado el siguiente paso.',
    durationMin: 75,
    priceCop: null,
    sessionsAdvice: null,
    category: 'General',
    icon: 'activity',
    benefits: ['Comparación con la cita anterior', 'Ajuste del plan', 'Próxima cita agendada'],
    featured: false,
    sortOrder: 3,
  },
  {
    slug: 'revision-de-medicacion',
    name: 'Revisión de medicación',
    shortDesc: 'Lo que toma, en qué dosis y desde cuándo, para tratarle con seguridad.',
    description:
      'Revisamos todos los medicamentos que toma —también los de otros especialistas— para evitar interacciones y ajustar dosis cuando haga falta.',
    durationMin: 75,
    priceCop: null,
    sessionsAdvice: null,
    category: 'General',
    icon: 'shield',
    benefits: ['Lista de medicación al día', 'Revisión de interacciones', 'Indicaciones claras'],
    featured: false,
    sortOrder: 4,
  },
];

/**
 * Horario de atención inicial. 0 es domingo.
 *
 * Neutro, hasta que el centro ponga el suyo desde el panel: mañana y tarde
 * entre semana con una hora de almuerzo, el sábado solo la mañana y el
 * domingo cerrado. Cuadra con la cita de 75 minutos —cuatro por la mañana,
 * tres por la tarde— para que no sobren ratos muertos.
 */
const BUSINESS_HOURS = [
  { dayOfWeek: 0, openTime: '08:00', closeTime: '13:00', breakStart: null, breakEnd: null, active: false },
  ...[1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    openTime: '08:00',
    closeTime: '18:00',
    breakStart: '13:00',
    breakEnd: '14:00',
    active: true,
  })),
  { dayOfWeek: 6, openTime: '08:00', closeTime: '13:00', breakStart: null, breakEnd: null, active: true },
];

async function main(): Promise<void> {
  // `||` y no `??`: una variable declarada pero vacía en el .env —que es el
  // estado normal de una plantilla sin llenar— es `''`, y `??` solo sustituye
  // null o undefined. Con `??`, un SEED_ADMIN_PASSWORD= vacío creaba el
  // usuario administrador con contraseña vacía y la imprimía en blanco.
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@clinica.com';

  // Sin contraseña en el entorno se genera una aleatoria y se imprime una sola
  // vez. Nunca se deja una por defecto en el código: sería pública en el
  // repositorio y quedaría igual en todos los despliegues.
  const generated = !process.env.SEED_ADMIN_PASSWORD;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || generatePassword();

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    // Si el usuario ya existe no se le toca la contraseña: volver a correr el
    // seed no debe echar abajo la que el equipo ya cambió.
    update: {},
    create: {
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
      fullName: 'Administración [NOMBRE_CLÍNICA]',
      role: Role.ADMIN,
    },
  });

  console.log(`✅ Usuario administrador: ${admin.email}`);
  if (existing) {
    console.log('   (ya existía; se conserva su contraseña actual)');
  }

  /*
   * Solo se crea lo que falte. El horario se edita desde el panel, y volver a
   * sembrar no puede pisar el que el centro ya puso.
   */
  for (const hours of BUSINESS_HOURS) {
    await prisma.businessHour.upsert({
      where: { dayOfWeek: hours.dayOfWeek },
      update: {},
      create: hours,
    });
  }
  console.log(`✅ Horario de atención: ${BUSINESS_HOURS.length} días (los existentes no se tocan)`);

  /**
   * Se CREA lo que falte y no se toca lo que ya existe.
   *
   * Antes hacía `update: service`, y eso significaba que volver a sembrar
   * borraba de un plumazo cualquier precio, descripción o duración que el
   * centro hubiera ajustado desde Tratamientos. El seed sirve para poblar una
   * base vacía, no para mandar sobre el trabajo de quien usa el sistema.
   */
  let creados = 0;
  for (const service of SERVICES) {
    const existe = await prisma.service.findUnique({
      where: { slug: service.slug },
      select: { id: true },
    });
    if (existe) continue;
    await prisma.service.create({ data: service });
    creados += 1;
  }
  console.log(
    `✅ Tratamientos: ${creados} nuevo(s); ${SERVICES.length - creados} ya existían y se dejaron como estaban.`,
  );

  if (!existing) {
    console.log('\n👤 Accede al panel con:');
    console.log(`   Correo:     ${adminEmail}`);
    console.log(`   Contraseña: ${adminPassword}`);
    if (generated) {
      console.log('   ⚠️  Esta contraseña se generó al azar y NO se vuelve a mostrar.');
      console.log('       Guárdala ahora y cámbiala desde el panel al entrar.\n');
    } else {
      console.log('   ⚠️  Cámbiala en cuanto entres por primera vez.\n');
    }
  }
}

/** Contraseña aleatoria legible, con entropía criptográfica. */
function generatePassword(length = 20): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789#$%&*+';
  const bytes = randomBytes(length);
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += alphabet[bytes[index] % alphabet.length];
  }
  return result;
}

main()
  .catch((error) => {
    console.error('❌ Falló el seed:', error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
