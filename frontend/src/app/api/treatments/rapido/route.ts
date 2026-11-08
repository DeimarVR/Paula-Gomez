import { NextResponse } from 'next/server';
import { Role } from '@prisma/client';
import { prisma } from '@/server/lib/prisma';
import { body, requireRole, route } from '@/server/http';
import { servicioRapidoSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Convierte "Control de seguimiento" en "control-de-seguimiento".
 *
 * Se quitan las tildes con `normalize('NFD')`, que separa la letra de su
 * acento, y luego se borran los acentos sueltos. Sin eso, "armonización"
 * quedaría como "armonizacin".
 */
function aSlug(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Añade -2, -3… hasta encontrar uno libre. El slug es único en la base. */
async function slugLibre(base: string): Promise<string> {
  const raiz = base || 'tratamiento';
  for (let intento = 0; intento < 50; intento += 1) {
    const candidato = intento === 0 ? raiz : `${raiz}-${intento + 1}`;
    const existe = await prisma.service.findUnique({ where: { slug: candidato } });
    if (!existe) return candidato;
  }
  return `${raiz}-${Date.now()}`;
}

/**
 * Alta rápida de un tratamiento, desde cualquier sitio donde se elija uno.
 *
 * Lo puede hacer ADMIN o PROFESIONAL: quien define un protocolo nuevo suele ser
 * quien está atendiendo, y obligarlo a pedirle el favor a un administrador es
 * justo la fricción que se quiere quitar. Recepción no, porque el precio y la
 * duración salen de aquí.
 */
export const POST = route(async (req) => {
  requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  const datos = await body(req, servicioRapidoSchema);

  const servicio = await prisma.service.create({
    data: {
      name: datos.name,
      slug: await slugLibre(aSlug(datos.name)),
      // Marcadores honestos: dicen que falta escribirlos, en vez de fingir
      // una descripción que nadie redactó.
      shortDesc: 'Pendiente de descripción.',
      description:
        'Este tratamiento se creó desde el panel para poder usarlo de inmediato. ' +
        'Falta completar su descripción antes de publicarlo en la web.',
      durationMin: datos.durationMin,
      priceCop: datos.priceCop ?? null,
      sessionsAdvice: datos.sessionsAdvice ?? null,
      category: datos.category,
      active: true,
      published: false,
    },
  });

  return NextResponse.json(servicio, { status: 201 });
});
