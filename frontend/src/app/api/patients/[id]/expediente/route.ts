import { Role } from '@prisma/client';
import { z } from 'zod';
import * as expediente from '@/server/modules/expediente/expediente.service';
import { body, requireAuth, requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/** El expediente completo: lo lee todo el equipo. */
export const GET = route<Ctx>(async (req, { params }) => {
  requireAuth(req);
  return expediente.leerExpediente(params.id);
});

const texto = z.string().trim().max(4000).nullable().optional();

const cambioSchema = z.discriminatedUnion('seccion', [
  z.object({
    seccion: z.literal('tratamiento'),
    motivo: texto,
    diagnostico: texto,
    plan: texto,
    controlesPrevistos: z.number().int().min(0).max(99).nullable().optional(),
  }),
  z.object({
    seccion: z.literal('antecedentes'),
    alergias: texto,
    personales: texto,
    quirurgicos: texto,
    familiares: texto,
  }),
]);

/**
 * Editar lo que se trata o los antecedentes.
 *
 * Lo clínico lo escriben la especialista y el equipo profesional; recepción
 * lo ve pero no lo cambia.
 */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const usuario = requireRole(req, Role.ADMIN, Role.PROFESIONAL);
  const datos = await body(req, cambioSchema);
  // El servicio solo lee los campos de su sección; `seccion` viaja de más y se ignora.
  return datos.seccion === 'tratamiento'
    ? expediente.guardarTratamiento(params.id, datos, usuario)
    : expediente.guardarAntecedentes(params.id, datos, usuario);
});
