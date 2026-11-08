import { randomBytes } from 'node:crypto';

/**
 * Tokens de los enlaces que se le mandan al paciente.
 *
 * Hay dos: el de seguimiento, que le abre su historia y sus fotos, y el de la
 * cita, que le deja confirmarla o cancelarla. Ninguno pide contraseña: el
 * enlace ES la llave, y por eso tiene que ser imposible de adivinar.
 *
 * Antes salían de `cuid()`, que es lo que pone Prisma por defecto. `cuid()`
 * está hecho para que dos registros no choquen, NO para guardar un secreto, y
 * la diferencia se ve mirando tres seguidos:
 *
 *   cmtst7odw 0000 le6b l3y63g4f
 *   cmtst7odw 0001 le6b bt1yh0a3
 *   cmtst7odw 0002 le6b ixh303ae
 *
 * Fecha y hora · un contador que va sumando · la huella de la máquina · y solo
 * el último trozo al azar. De veinticinco caracteres, diecisiete se deducen.
 *
 * `randomBytes` es del módulo de criptografía del sistema: los 24 bytes salen
 * de la fuente de azar del sistema operativo, sin fecha, sin contador y sin
 * nada que relacione un token con el siguiente. `base64url` porque el
 * resultado viaja dentro de una dirección web y no puede llevar `+`, `/` ni
 * `=`.
 */
export function tokenDeEnlace(): string {
  return randomBytes(24).toString('base64url');
}
