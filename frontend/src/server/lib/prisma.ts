import { PrismaClient } from '@prisma/client';
import { isProd } from '../config/env';

/**
 * Cliente de Prisma, uno por instancia de función.
 *
 * En serverless cada invocación puede reutilizar el mismo proceso, pero
 * también puede arrancar uno nuevo. Guardar el cliente en `globalThis` evita
 * lo que de otro modo pasa siempre: cada recarga en desarrollo, y cada módulo
 * reevaluado en producción, abriría una conexión más contra Postgres hasta
 * agotar el tope del servidor.
 *
 * El número de conexiones por instancia se limita desde `DATABASE_URL`, con
 * `?connection_limit=1&pool_timeout=20`. Ver DESPLIEGUE.md.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (!isProd) globalForPrisma.prisma = prisma;

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
