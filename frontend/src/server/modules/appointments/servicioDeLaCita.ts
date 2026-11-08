import { CITA } from '@/lib/agenda';
import { prisma } from '../../lib/prisma';
import type { Db } from '../../lib/cerrojo';

/**
 * El servicio que respalda todas las citas.
 *
 * La tabla de citas exige un servicio, y antes cada cita llevaba el
 * tratamiento que el paciente elegía al reservar. Ahora hay un solo tipo de
 * cita, así que todas apuntan a este.
 *
 * Se crea solo la primera vez que hace falta, en vez de depender de que alguien
 * corra el seed: una base recién desplegada tiene que poder recibir la primera
 * reserva sin pasos previos. No se publica —no es un tratamiento del catálogo—
 * y si ya existe no se le toca nada.
 *
 * La duración NO se lee de aquí: manda `CITA.duracionMin`. Si alguien edita
 * este registro, la agenda no cambia de forma.
 */
export async function servicioDeLaCita(db: Db = prisma) {
  return db.service.upsert({
    where: { slug: CITA.slug },
    update: {},
    create: {
      slug: CITA.slug,
      name: CITA.nombre,
      shortDesc: 'Consulta con la especialista.',
      description: 'Consulta con la especialista. Es el único tipo de cita de la agenda.',
      durationMin: CITA.duracionMin,
      category: 'Consulta',
      icon: 'stethoscope',
      active: true,
      published: false,
      sortOrder: 999,
    },
    select: { id: true, name: true },
  });
}
