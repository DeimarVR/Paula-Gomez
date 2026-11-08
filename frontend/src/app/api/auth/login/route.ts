import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/server/lib/prisma';
import { HttpError } from '@/server/lib/httpError';
import { LIMITES, body, limitar, route, signToken } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().email('Correo inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export const POST = route(async (req) => {
  limitar(req, 'login', LIMITES.login);
  const { email, password } = await body(req, loginSchema);

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

  // Se compara siempre contra un hash aunque el usuario no exista, para que
  // el tiempo de respuesta no revele qué correos están registrados.
  const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const valid = await bcrypt.compare(password, hash);

  if (!user || !valid || !user.active) {
    throw HttpError.unauthorized('Correo o contraseña incorrectos');
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const token = signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  });

  const respuesta = NextResponse.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });

  // Además del token que guarda el navegador para llamar a la API, se deja una
  // cookie httpOnly. Sirve para una sola cosa: que las etiquetas <img> del
  // panel puedan pedir las fotos protegidas, que no pueden mandar encabezados.
  respuesta.cookies.set('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60,
  });

  return respuesta;
});
