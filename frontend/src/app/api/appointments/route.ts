import { NextResponse } from 'next/server';
import { AppointmentStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { env } from '@/server/config/env';
import { HttpError } from '@/server/lib/httpError';
import { parseZonedDateTime } from '@/server/lib/datetime';
import * as service from '@/server/modules/appointments/appointments.service';
import { body, query, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const listQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  /**
   * Qué tramo de la agenda se pide.
   *
   * Por defecto, lo que viene. La lista salía entera y en orden ascendente, así
   * que arriba quedaba la cita más vieja del histórico y la agenda de hoy
   * aparecía enterrada páginas más abajo: justo al revés de para qué se abre
   * esta pantalla.
   *
   * `from`/`to` siguen mandando si se pasan: son para consultas concretas y no
   * tienen por qué respetar este atajo.
   */
  periodo: z.enum(['proximas', 'pasadas', 'todas']).default('proximas'),
  /**
   * Un día concreto de la agenda, «2026-11-17», en la zona del centro.
   *
   * La vista de día del panel lo pide así y no con `from`/`to`: armar la
   * medianoche en el navegador usaría su zona horaria, y un portátil mal
   * configurado vería las citas de otro día.
   */
  dia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  q: z.string().trim().min(1).optional(),
  take: z.coerce.number().int().min(1).max(200).default(50),
  skip: z.coerce.number().int().min(0).default(0),
});

export const GET = route(async (req) => {
  requireAuth(req);
  const q = query(req, listQuerySchema);

  /**
   * El corte es el comienzo de HOY en hora de la clínica, no «ahora».
   *
   * Con «ahora», una cita de las 9 de la mañana desaparecía de la lista a las
   * 9:01, y es justo la que recepción sigue necesitando el resto del día para
   * anotar que el paciente vino, facturarle o abrirle la ficha.
   */
  const inicioDeHoy = parseZonedDateTime(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: env.CLINIC_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()),
    '00:00',
    env.CLINIC_TIMEZONE,
  );

  const rangoDelDia = q.dia
    ? (() => {
        const inicio = parseZonedDateTime(q.dia, '00:00', env.CLINIC_TIMEZONE);
        const siguiente = new Intl.DateTimeFormat('en-CA', {
          timeZone: env.CLINIC_TIMEZONE,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(inicio.getTime() + 36 * 3600_000));
        return {
          startsAt: { gte: inicio, lt: parseZonedDateTime(siguiente, '00:00', env.CLINIC_TIMEZONE) },
        };
      })()
    : null;

  const rangoDelPeriodo = rangoDelDia
    ? rangoDelDia
    : q.from || q.to
      ? {
          startsAt: {
            ...(q.from ? { gte: new Date(q.from) } : {}),
            ...(q.to ? { lte: new Date(q.to) } : {}),
          },
        }
      : q.periodo === 'proximas'
        ? { startsAt: { gte: inicioDeHoy } }
        : q.periodo === 'pasadas'
          ? { startsAt: { lt: inicioDeHoy } }
          : {};

  const where = {
    ...(q.status ? { status: q.status } : {}),
    ...rangoDelPeriodo,
    /**
     * Se busca por los datos de contacto de la cita Y por la cédula de la ficha
     * vinculada. Los primeros son los que se escribieron al agendar —que puede
     * ser un familiar llamando— y la cédula es lo único que identifica sin
     * ambigüedad a un paciente con homónimo.
     */
    ...(q.q
      ? {
          OR: [
            { contactName: { contains: q.q, mode: 'insensitive' as const } },
            { contactPhone: { contains: q.q } },
            { contactEmail: { contains: q.q, mode: 'insensitive' as const } },
            { patient: { documentId: { contains: q.q } } },
            { patient: { fullName: { contains: q.q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, slug: true, durationMin: true } },
        patient: { select: { id: true, fullName: true, publicToken: true } },
      },
      /**
       * Lo pasado se lee del revés: lo primero que se busca en el histórico es
       * lo de ayer, no lo del año pasado.
       */
      orderBy: {
        startsAt: q.periodo === 'pasadas' && !q.from && !q.to && !q.dia ? 'desc' : 'asc',
      },
      take: q.take,
      skip: q.skip,
    }),
    prisma.appointment.count({ where }),
  ]);

  return { items, total, take: q.take, skip: q.skip };
});

/**
 * Alta de cita desde el panel.
 *
 * La fecha llega partida en `fecha` + `hora`, en hora de la clínica, y no como
 * un instante ya resuelto. Es a propósito: si el navegador construyera el
 * instante con `new Date('2026-09-01T09:30')` usaría SU zona horaria, y una
 * cita agendada desde un portátil con la zona mal puesta —o desde otro país—
 * quedaría corrida. Aquí se convierte con la zona de la clínica, que es la
 * única que manda.
 */
const createSchema = z.object({
  /** Ya no decide nada: hay un solo tipo de cita. */
  serviceId: z.string().optional(),
  contactName: z.string().trim().min(2, 'Escribe el nombre del paciente'),
  contactPhone: z.string().trim().min(7, 'El teléfono es obligatorio'),
  contactEmail: z.string().email('Ese correo no es válido').optional().or(z.literal('')),
  message: z.string().trim().max(1000).optional(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige una fecha'),
  hora: z.string().regex(/^\d{2}:\d{2}$/, 'Elige una hora'),
  patientId: z.string().optional(),
});

export const POST = route(async (req) => {
  requireAuth(req);
  const datos = await body(req, createSchema);

  let startsAt: Date;
  try {
    startsAt = parseZonedDateTime(datos.fecha, datos.hora, env.CLINIC_TIMEZONE);
  } catch {
    throw HttpError.badRequest('La fecha y la hora no son válidas');
  }

  const result = await service.createBooking({
    contactName: datos.contactName,
    contactPhone: datos.contactPhone,
    contactEmail: datos.contactEmail || undefined,
    message: datos.message,
    patientId: datos.patientId || undefined,
    startsAt,
    source: 'PRESENCIAL',
    /**
     * El centro agenda con el paciente delante: la cita puede ser dentro de
     * una hora, a más de 60 días o a una hora que no es comienzo de bloque. Lo
     * que NO se salta es el horario de atención ni el cruce con otra cita.
     */
    desdeElPanel: true,
  });

  return NextResponse.json(result, { status: 201 });
});
