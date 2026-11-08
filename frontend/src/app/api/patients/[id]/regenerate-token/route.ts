import { Role } from '@prisma/client';
import { env } from '@/server/config/env';
import { prisma } from '@/server/lib/prisma';
import { tokenDeEnlace } from '@/server/lib/tokens';
import { requireRole, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Regenera el enlace de seguimiento (por ejemplo si el paciente lo compartió). */
export const POST = route<{ params: { id: string } }>(async (req, { params }) => {
  requireRole(req, Role.ADMIN);

  /**
   * Antes esto era `Date.now()` pegado a `Math.random()`.
   *
   * Las dos mitades estaban mal: la fecha no es azar —quien vea el token sabe
   * cuándo se generó y puede reconstruirla—, y `Math.random()` es un generador
   * para repartir cartas, no para guardar secretos; a partir de unos pocos
   * valores observados se puede predecir el siguiente.
   *
   * Y este token es justo el que se regenera CUANDO YA HUBO UN PROBLEMA: el
   * paciente compartió su enlace donde no debía. El reemplazo tenía que ser
   * más fuerte que el original, no igual de débil.
   */
  const fresh = tokenDeEnlace();
  const patient = await prisma.patient.update({
    where: { id: params.id },
    data: { publicToken: fresh },
  });

  return {
    publicToken: patient.publicToken,
    trackingUrl: `${env.PUBLIC_WEB_URL}/seguimiento/${patient.publicToken}`,
  };
});
