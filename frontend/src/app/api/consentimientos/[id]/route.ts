import { Role } from '@prisma/client';
import * as consentimientos from '@/server/modules/consentimientos/consentimientos.service';
import { z } from 'zod';
import { body, booleanoDeConsulta, query, requireAuth, requireRole, route } from '@/server/http';
import { plantillaSchema } from '../esquema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const accionSchema = z.object({
  definitivo: booleanoDeConsulta.optional(),
  activa: booleanoDeConsulta.optional(),
});

export const PUT = route(async (req, { params }: { params: { id: string } }) => {
  requireAuth(req);
  return consentimientos.actualizarPlantilla(params.id, await body(req, plantillaSchema));
});

/**
 * Archiva, reactiva o borra. Solo el administrador.
 *
 * `definitivo=true` borra de verdad, y el servicio exige que ya esté
 * archivada. `activa=true` la devuelve a la lista.
 */
export const DELETE = route(async (req, { params }: { params: { id: string } }) => {
  requireRole(req, Role.ADMIN);
  const opciones = query(req, accionSchema);

  if (opciones.definitivo) return consentimientos.eliminarPlantilla(params.id);
  if (opciones.activa) return consentimientos.reactivarPlantilla(params.id);
  return consentimientos.archivarPlantilla(params.id);
});
