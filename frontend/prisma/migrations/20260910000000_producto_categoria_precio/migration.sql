-- Categoría, precio de venta y proveedor del producto.
--
-- `IF NOT EXISTS` a propósito: estas columnas se agregan a mano en Railway
-- antes de cargar el inventario, así que cuando Prisma aplique esta migración
-- ya van a estar. Sin eso, `migrate deploy` fallaría por columna duplicada y
-- dejaría la migración a medias.
--
-- Las tres admiten NULL: los productos que ya existen siguen válidos.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "category"  TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "salePrice" INTEGER;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "supplier"  TEXT;
