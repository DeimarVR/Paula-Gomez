-- CreateEnum
CREATE TYPE "ProductKind" AS ENUM ('MEDICAMENTO', 'INSUMO');

-- CreateEnum
CREATE TYPE "StockMoveType" AS ENUM ('ENTRADA', 'SALIDA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "StockMoveReason" AS ENUM ('COMPRA', 'USO_EN_PACIENTE', 'DEVOLUCION', 'VENCIMIENTO', 'DANO', 'CONTEO', 'OTRO');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ProductKind" NOT NULL DEFAULT 'INSUMO',
    "sku" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "presentation" TEXT,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_moves" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMoveType" NOT NULL,
    "reason" "StockMoveReason" NOT NULL DEFAULT 'OTRO',
    "quantity" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "patientId" TEXT,
    "lotNumber" TEXT,
    "expiresAt" TIMESTAMP(3),
    "unitCost" INTEGER,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_moves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_active_name_idx" ON "products"("active", "name");

-- CreateIndex
CREATE INDEX "stock_moves_productId_occurredAt_idx" ON "stock_moves"("productId", "occurredAt");

-- CreateIndex
CREATE INDEX "stock_moves_patientId_idx" ON "stock_moves"("patientId");

-- CreateIndex
CREATE INDEX "stock_moves_occurredAt_idx" ON "stock_moves"("occurredAt");

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_moves" ADD CONSTRAINT "stock_moves_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
