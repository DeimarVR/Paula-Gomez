-- Vender un producto descuenta del inventario cuando la factura se cobra.
--
-- Tres cosas: la línea de la factura recuerda de qué producto es, el movimiento
-- de stock recuerda de qué factura salió, y aparece el motivo VENTA.
--
-- Todo es «si no existe ya», así que se puede correr a mano en Railway y
-- después `prisma migrate deploy` sin que la segunda vez rompa nada.
--
-- ── Sin una sola consulta de lectura, a propósito ────────────────────────
--
-- La consola SQL de Railway le añade un `LIMIT` al final a cualquier script
-- donde detecte una consulta de lectura, y basta con que la palabra aparezca
-- —incluso dentro de un comentario como este— para que lo haga. Este script
-- llevaba una comprobación de ese tipo sobre `pg_constraint`, dentro de un
-- bloque DO, para no repetir la llave foránea si ya existía. Con eso sobró:
-- Railway pegó su LIMIT al final, Postgres devolvió «syntax error at or near
-- LIMIT» y no se ejecutó NADA, ni siquiera las líneas anteriores al error.
--
-- Por eso la llave foránea se hace con DROP IF EXISTS + ADD en vez de
-- preguntar antes si está. Consigue lo mismo —correrlo dos veces no falla— sin
-- que aparezca la palabra prohibida en ninguna parte del archivo.

-- ---------------------------------------------------------------------------
-- 1. El motivo VENTA
-- ---------------------------------------------------------------------------
-- `AFTER` solo es para que el orden en la base coincida con el del schema; a
-- efectos prácticos da igual dónde quede.
ALTER TYPE "StockMoveReason" ADD VALUE IF NOT EXISTS 'VENTA' AFTER 'USO_EN_PACIENTE';

-- ---------------------------------------------------------------------------
-- 2. La línea de la factura recuerda su producto
-- ---------------------------------------------------------------------------
-- Nace en NULL en todo lo que ya existe, y así se queda: las facturas viejas
-- se descontaron a mano en su momento y volver a descontarlas ahora dejaría el
-- inventario peor de lo que está.
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "productId" TEXT;

CREATE INDEX IF NOT EXISTS "invoice_items_productId_idx"
  ON "invoice_items" ("productId");

-- El DROP no borra datos: solo suelta la regla, y la línea siguiente la vuelve
-- a poner igual. Es la forma de que correr esto dos veces no falle.
ALTER TABLE "invoice_items" DROP CONSTRAINT IF EXISTS "invoice_items_productId_fkey";
ALTER TABLE "invoice_items"
  ADD CONSTRAINT "invoice_items_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. El movimiento de stock recuerda su factura
-- ---------------------------------------------------------------------------
-- Es lo que hace que descontar sea reversible y no se pueda descontar dos
-- veces: la salida de una venta se busca por aquí para quitarla si la factura
-- se anula o se le deshace el cobro.
ALTER TABLE "stock_moves" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;

CREATE INDEX IF NOT EXISTS "stock_moves_invoiceId_idx"
  ON "stock_moves" ("invoiceId");

ALTER TABLE "stock_moves" DROP CONSTRAINT IF EXISTS "stock_moves_invoiceId_fkey";
ALTER TABLE "stock_moves"
  ADD CONSTRAINT "stock_moves_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
