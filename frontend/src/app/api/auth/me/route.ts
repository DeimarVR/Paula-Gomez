import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { body, requireAuth, route } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const sesion = requireAuth(req);

  const user = await prisma.user.findUnique({
    where: { id: sesion.sub },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      lastLoginAt: true,
      signature: true,
    },
  });
  if (!user) throw HttpError.unauthorized('El usuario ya no existe');

  return { user };
});

/**
 * Lo que cada quien puede cambiar de su propia cuenta: su nombre y su firma.
 *
 * El correo y el ROL no están aquí a propósito. El correo es con lo que se
 * entra, y el rol es el permiso: si alguien pudiera cambiarse el suyo, los
 * candados de `requireRole` no valdrían nada. Eso lo toca un administrador
 * desde la base, que es donde debe doler cambiarlo.
 *
 * La firma se valida como PNG y con tope de tamaño, igual que las de los
 * documentos: este valor termina en el `src` de una etiqueta `img`, y aceptar
 * cualquier cadena dejaría meter ahí un `data:text/html` con script dentro.
 */
const perfilSchema = z
  .object({
    fullName: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120),
    signature: z
      .string()
      .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, 'La firma debe ser una imagen PNG')
      .max(600_000, 'La firma es demasiado pesada')
      .nullable(),
  })
  .partial();

export const PUT = route(async (req) => {
  const sesion = requireAuth(req);
  const datos = await body(req, perfilSchema);

  // Solo se escriben las claves que llegaron: mandar únicamente el nombre no
  // puede borrar la firma, ni al revés.
  const user = await prisma.user.update({
    where: { id: sesion.sub },
    data: {
      ...(datos.fullName !== undefined ? { fullName: datos.fullName } : {}),
      ...(datos.signature !== undefined ? { signature: datos.signature } : {}),
    },
    select: { id: true, email: true, fullName: true, role: true, signature: true },
  });

  return { user };
});
