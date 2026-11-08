import type { IntegrationToken } from '@prisma/client';
import { prisma } from '../lib/prisma';

export type Provider = 'instagram' | 'google_calendar' | 'whatsapp';

export interface SaveTokenInput {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scope?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  countRefresh?: boolean;
}

/**
 * Los tokens vivos se guardan en base de datos, no en el entorno.
 *
 * Motivo: el token de Instagram se auto-renueva y el valor nuevo tiene que
 * sobrevivir a reinicios y despliegues. Si solo estuviera en una variable de
 * entorno, cada redeploy volvería al token viejo y el feed se caería a los
 * 60 días. Las variables de entorno solo aportan el valor *inicial*.
 */
export async function getToken(provider: Provider): Promise<IntegrationToken | null> {
  return prisma.integrationToken.findUnique({ where: { provider } });
}

export async function saveToken(
  provider: Provider,
  input: SaveTokenInput,
): Promise<IntegrationToken> {
  const now = new Date();
  const base = {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken ?? null,
    expiresAt: input.expiresAt ?? null,
    scope: input.scope ?? null,
    accountId: input.accountId ?? null,
    accountName: input.accountName ?? null,
    lastRefreshedAt: now,
    lastError: null,
  };

  return prisma.integrationToken.upsert({
    where: { provider },
    create: { provider, ...base, refreshCount: 0 },
    update: {
      ...base,
      ...(input.countRefresh ? { refreshCount: { increment: 1 } } : {}),
    },
  });
}

/**
 * Borra el último fallo cuando algo vuelve a funcionar.
 *
 * Sin esto el aviso rojo de Integraciones se queda puesto para siempre: el
 * error se guardaba al fallar y solo se limpiaba al reconectar, así que después
 * de arreglar la causa el panel seguía gritando un problema que ya no existía y
 * había que explicarle a cada uno que no le hiciera caso.
 *
 * El `NOT` evita escribir en la base en cada cita cuando no hay nada que
 * limpiar, que es el caso normal.
 */
export async function clearTokenError(provider: Provider): Promise<void> {
  await prisma.integrationToken.updateMany({
    where: { provider, NOT: { lastError: null } },
    data: { lastError: null },
  });
}

/** Deja constancia del fallo sin borrar el token vigente. */
export async function recordTokenError(provider: Provider, message: string): Promise<void> {
  await prisma.integrationToken.updateMany({
    where: { provider },
    data: { lastError: message.slice(0, 500) },
  });
}

/** Días que faltan para que expire el token. `null` si no tiene vencimiento. */
export function daysUntilExpiry(token: IntegrationToken | null): number | null {
  if (!token?.expiresAt) return null;
  return Math.floor((token.expiresAt.getTime() - Date.now()) / 86_400_000);
}
