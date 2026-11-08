import { NextResponse, type NextRequest } from 'next/server';
import { Prisma, type Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { z, ZodError, type ZodTypeAny } from 'zod';
import { env, isProd } from './config/env';
import { HttpError } from './lib/httpError';
import { createLogger } from './lib/logger';

const log = createLogger('api');

/* -------------------------------------------------------------------------
 * Sesión
 * ---------------------------------------------------------------------- */

export interface AuthPayload {
  sub: string;
  email: string;
  role: Role;
  fullName: string;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Exige una sesión válida y devuelve quién es.
 *
 * Lanza en vez de devolver null a propósito: así una ruta que se olvide de
 * comprobar el resultado falla cerrada, no abierta.
 */
export function requireAuth(req: NextRequest): AuthPayload {
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) throw HttpError.unauthorized('Falta el token de sesión');

  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    throw HttpError.unauthorized('Sesión inválida o expirada');
  }
}

/**
 * Sesión leída del encabezado O de la cookie, solo para servir archivos.
 *
 * Las etiquetas `<img>` no pueden mandar un encabezado Authorization: el
 * navegador pide la imagen por su cuenta. Por eso el login deja además una
 * cookie httpOnly con el mismo token, y solo esta función la acepta.
 *
 * Deliberadamente NO se acepta la cookie en `requireAuth`: si una cookie
 * bastara para escribir, cualquier página ajena podría disparar peticiones
 * que modifiquen datos con la sesión del usuario. Leer una imagen es
 * inofensivo; crear un paciente no.
 */
export function sesionParaArchivos(req: NextRequest): AuthPayload | null {
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ')
    ? header.slice(7).trim()
    : req.cookies.get('token')?.value;

  if (!token) return null;

  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    return null;
  }
}

/** Exige sesión y además que el rol esté en la lista. */
export function requireRole(req: NextRequest, ...roles: Role[]): AuthPayload {
  const user = requireAuth(req);
  if (!roles.includes(user.role)) {
    throw HttpError.forbidden('Tu rol no tiene permiso para esta acción');
  }
  return user;
}

/* -------------------------------------------------------------------------
 * Entrada
 * ---------------------------------------------------------------------- */

/** Cuerpo JSON validado. Un JSON roto es 400; uno que no cumple, 422. */
export async function body<S extends ZodTypeAny>(
  req: NextRequest,
  schema: S,
): Promise<z.infer<S>> {
  let crudo: unknown;
  try {
    crudo = await req.json();
  } catch {
    throw HttpError.badRequest('El cuerpo de la petición no es JSON válido');
  }
  return schema.parse(crudo) as z.infer<S>;
}

/** Parámetros de consulta validados. */
export function query<S extends ZodTypeAny>(req: NextRequest, schema: S): z.infer<S> {
  const objeto = Object.fromEntries(req.nextUrl.searchParams.entries());
  return schema.parse(objeto) as z.infer<S>;
}

/**
 * Un sí/no que viene en la dirección: `?handled=false`.
 *
 * NO se puede usar `z.coerce.boolean()` para esto. Coerce hace `Boolean(valor)`,
 * y en JavaScript `Boolean('false')` es `true`: cualquier texto que no esté
 * vacío lo es. Así que `?handled=false` pedía justo lo contrario de lo que
 * dice, en silencio y sin dar ningún error.
 *
 * Aquí solo valen las dos palabras, y cualquier otra cosa se rechaza en vez de
 * adivinar.
 */
export const booleanoDeConsulta = z
  .enum(['true', 'false'])
  .transform((texto) => texto === 'true');

/* -------------------------------------------------------------------------
 * Salida
 * ---------------------------------------------------------------------- */

/**
 * Traduce cualquier error a una respuesta.
 *
 * Es el mismo criterio que tenía el manejador de errores de Express: los
 * errores de Prisma que representan un conflicto real de datos se responden
 * como 409 o 404, no como 500, porque no son fallos del servidor sino del
 * estado de la base.
 */
export function fail(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'validation_error',
        message: 'Los datos enviados no son válidos',
        details: err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 422 },
    );
  }

  if (err instanceof HttpError) {
    return NextResponse.json(
      {
        error: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
      { status: err.status },
    );
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'campo';
      return NextResponse.json(
        { error: 'conflict', message: `Ya existe un registro con ese ${target}` },
        { status: 409 },
      );
    }
    if (err.code === 'P2025') {
      return NextResponse.json(
        { error: 'not_found', message: 'Registro no encontrado' },
        { status: 404 },
      );
    }
    if (err.code === 'P2003') {
      return NextResponse.json(
        { error: 'conflict', message: 'No se puede completar: hay registros relacionados' },
        { status: 409 },
      );
    }
  }

  log.error('Error no controlado', err);
  return NextResponse.json(
    {
      error: 'internal_error',
      message: 'Ocurrió un error inesperado. Intenta de nuevo.',
      ...(isProd ? {} : { detail: err instanceof Error ? err.message : String(err) }),
    },
    { status: 500 },
  );
}

type Contexto = { params: Record<string, string> };

/**
 * Envuelve un manejador de ruta.
 *
 * Devolver un objeto plano basta: se serializa a JSON. Lo que importa es que
 * ningún error se escape sin traducir, que es lo que hacía el middleware de
 * errores y aquí no existe.
 */
export function route<C extends Contexto = Contexto>(
  fn: (req: NextRequest, ctx: C) => Promise<unknown>,
) {
  return async (req: NextRequest, ctx: C): Promise<NextResponse> => {
    try {
      const salida = await fn(req, ctx);
      if (salida instanceof NextResponse) return salida;
      return NextResponse.json(salida ?? {});
    } catch (err) {
      return fail(err);
    }
  };
}

/* -------------------------------------------------------------------------
 * Límite de peticiones
 * ---------------------------------------------------------------------- */

const contadores = new Map<string, { hasta: number; usos: number }>();

/**
 * Freno de fuerza bruta, best effort.
 *
 * ADVERTENCIA HONESTA: el contador vive en memoria de la instancia. En
 * serverless hay varias instancias a la vez y se reciclan, así que un atacante
 * decidido puede saltárselo repartiendo intentos. Frena lo que frenaba el
 * limitador de Express en el 90% de los casos —el script tonto que prueba
 * contraseñas en bucle— y no pretende más.
 *
 * Un límite de verdad necesita almacenamiento compartido (Vercel KV, Upstash).
 * Está anotado como pendiente en DESPLIEGUE.md.
 */
export function limitar(
  req: NextRequest,
  clave: string,
  { usos, ventanaMs, mensaje }: { usos: number; ventanaMs: number; mensaje: string },
): void {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'desconocida';
  const id = `${clave}:${ip}`;
  const ahora = Date.now();

  const actual = contadores.get(id);
  if (!actual || actual.hasta < ahora) {
    contadores.set(id, { hasta: ahora + ventanaMs, usos: 1 });
  } else {
    actual.usos += 1;
    if (actual.usos > usos) throw new HttpError(429, mensaje, 'rate_limited');
  }

  // Limpieza perezosa: sin esto el mapa crecería sin límite mientras viva la
  // instancia, que es un goteo de memoria lento pero real.
  if (contadores.size > 5_000) {
    for (const [k, v] of contadores) if (v.hasta < ahora) contadores.delete(k);
  }
}

export const LIMITES = {
  login: { usos: 10, ventanaMs: 15 * 60_000, mensaje: 'Demasiados intentos de acceso. Intenta de nuevo en 15 minutos.' },
  formulario: { usos: 8, ventanaMs: 10 * 60_000, mensaje: 'Recibimos varias solicitudes desde este dispositivo. Escríbenos por WhatsApp si es urgente.' },
} as const;
