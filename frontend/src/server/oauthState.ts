import { randomBytes } from 'node:crypto';
import { prisma } from './lib/prisma';
import { HttpError } from './lib/httpError';

/**
 * `state` de OAuth de un solo uso, guardado en la base.
 *
 * En el backend de Express esto vivía en un Map en memoria, y ahí funcionaba
 * porque el proceso era uno solo. Aquí no: la petición que pide el enlace de
 * autorización y la que vuelve desde Google o Meta caen casi seguro en
 * instancias distintas de la función, así que un Map nunca encontraría el
 * state y toda conexión fallaría con "el enlace expiró".
 *
 * La tabla `settings` sirve de almacén compartido. Cada state se borra al
 * consumirse —de un solo uso, que es justo lo que lo hace útil contra CSRF— y
 * los caducados se limpian de paso.
 */
const PREFIJO = 'oauth_state:';
const VIGENCIA_MS = 10 * 60_000;

export async function issueState(provider: string): Promise<string> {
  const state = randomBytes(24).toString('hex');

  await prisma.setting.create({
    data: {
      key: `${PREFIJO}${state}`,
      value: JSON.stringify({ provider, expiresAt: Date.now() + VIGENCIA_MS }),
    },
  });

  // Limpieza oportunista de los que ya caducaron.
  const viejos = await prisma.setting.findMany({
    where: { key: { startsWith: PREFIJO }, updatedAt: { lt: new Date(Date.now() - VIGENCIA_MS) } },
    select: { key: true },
  });
  if (viejos.length > 0) {
    await prisma.setting.deleteMany({ where: { key: { in: viejos.map((v) => v.key) } } });
  }

  return state;
}

export async function consumeState(state: string | undefined, provider: string): Promise<void> {
  if (!state) throw HttpError.badRequest('Falta el parámetro state');

  const key = `${PREFIJO}${state}`;
  const registro = await prisma.setting.findUnique({ where: { key } });
  if (registro) await prisma.setting.delete({ where: { key } }).catch(() => undefined);

  if (!registro) throw HttpError.badRequest('El enlace de autorización expiró. Vuelve a intentarlo.');

  const datos = JSON.parse(registro.value) as { provider: string; expiresAt: number };
  if (datos.provider !== provider || datos.expiresAt < Date.now()) {
    throw HttpError.badRequest('El enlace de autorización expiró. Vuelve a intentarlo.');
  }
}
