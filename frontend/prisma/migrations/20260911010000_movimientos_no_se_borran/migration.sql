-- Un movimiento de inventario no se borra nunca: se corrige.
--
-- Antes había un botón que borraba la fila. Eso no deshace el error, lo
-- esconde: al día siguiente nadie puede responder «¿por qué el conteo no
-- cuadra?» porque la pista ya no está. Ahora se registra otro movimiento en
-- sentido contrario y los dos se quedan en el historial.
--
-- Dos cosas: el motivo CORRECCION y el campo que une la corrección con lo que
-- corrige. Nada se borra ni se cambia de valor.
--
-- Sin consultas de lectura, ni siquiera en los comentarios: la consola de
-- Railway le añade un LIMIT al final a cualquier script donde detecte una, y
-- entonces no se ejecuta nada.

-- ---------------------------------------------------------------------------
-- 1. El motivo CORRECCION
-- ---------------------------------------------------------------------------
ALTER TYPE "StockMoveReason" ADD VALUE IF NOT EXISTS 'CORRECCION' AFTER 'CONTEO';

-- ---------------------------------------------------------------------------
-- 2. Qué movimiento corrige cada corrección
-- ---------------------------------------------------------------------------
-- Único: un movimiento solo se puede corregir una vez. Sin esa regla, corregir
-- dos veces el mismo restaría el doble y el inventario quedaría peor que antes.
ALTER TABLE "stock_moves" ADD COLUMN IF NOT EXISTS "correctsId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "stock_moves_correctsId_key"
  ON "stock_moves" ("correctsId");

-- RESTRICT y no CASCADE: si alguien intentara borrar el movimiento original,
-- la base lo impide en vez de llevarse la corrección por delante.
ALTER TABLE "stock_moves" DROP CONSTRAINT IF EXISTS "stock_moves_correctsId_fkey";
ALTER TABLE "stock_moves"
  ADD CONSTRAINT "stock_moves_correctsId_fkey"
  FOREIGN KEY ("correctsId") REFERENCES "stock_moves"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
