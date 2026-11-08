import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

/** Lo que reciben las funciones que pueden correr dentro o fuera de una transacción. */
export type Db = PrismaClient | Prisma.TransactionClient;
export type Tx = Prisma.TransactionClient;

/*
 * Sin la palabra de consulta en mayúsculas: la consola de Railway le pega un
 * LIMIT a cualquier texto que la contenga, y este mismo patrón se copia a
 * veces allí para probar.
 */
const CERROJO = 'select pg_advisory_xact_lock(hashtext($1))';

/**
 * Corre `fn` en una transacción con un cerrojo de Postgres por nombre.
 *
 * Una transacción sola no basta para «mirar si está libre y guardar»: en el
 * aislamiento por defecto dos peticiones pueden mirar a la vez, ver las dos
 * el hueco libre y guardar las dos. El cerrojo hace que la segunda espere a
 * que la primera termine, y entonces ya ve la cita guardada. Se suelta solo
 * al cerrar la transacción, falle o no.
 *
 * Dentro de `fn` todo tiene que ir por `tx`. Con `connection_limit=1` la
 * transacción tiene la única conexión de la instancia, y una consulta por
 * `prisma` se quedaría esperando a una conexión que no se va a soltar.
 *
 * Los tiempos son más largos que los de Prisma por defecto (2 s para empezar,
 * 5 s en total) porque aquí se espera en fila: con varias reservas a la vez,
 * la última tiene que poder aguardar a las anteriores sin que salte un error.
 */
export function conCerrojo<T>(clave: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(CERROJO, clave);
      return fn(tx);
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

/**
 * El cerrojo de la agenda.
 *
 * Uno solo para toda la agenda, no uno por hora: reservar, mover, aceptar un
 * hueco ofrecido y cerrar un día se tocan entre sí —mover libera una hora y
 * ocupa otra—, y con un cerrojo por hora habría que tomar dos en el orden
 * correcto para no trabarse. Un centro con una especialista no tiene tráfico
 * para que esa fila se note.
 */
export function conCerrojoDeAgenda<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return conCerrojo('agenda', fn);
}
