-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO');

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'EFECTIVO',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_closes" (
    "id" TEXT NOT NULL,
    "closeDate" TIMESTAMP(3) NOT NULL,
    "expectedCash" INTEGER NOT NULL,
    "expectedOther" INTEGER NOT NULL,
    "expectedTotal" INTEGER NOT NULL,
    "countedCash" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "invoiceCount" INTEGER NOT NULL,
    "invoicedTotal" INTEGER NOT NULL,
    "notes" TEXT,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_closes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_paidAt_idx" ON "payments"("paidAt");

-- CreateIndex
CREATE INDEX "payments_invoiceId_idx" ON "payments"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "cash_closes_closeDate_key" ON "cash_closes"("closeDate");

-- CreateIndex
CREATE INDEX "cash_closes_closeDate_idx" ON "cash_closes"("closeDate");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_closes" ADD CONSTRAINT "cash_closes_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
