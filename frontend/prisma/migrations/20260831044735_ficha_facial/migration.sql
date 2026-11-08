-- CreateEnum
CREATE TYPE "SkinType" AS ENUM ('FITZ_I', 'FITZ_II', 'FITZ_III', 'FITZ_IV', 'FITZ_V', 'FITZ_VI');

-- CreateTable
CREATE TABLE "facial_records" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientDocument" TEXT,
    "patientAge" INTEGER,
    "patientPhone" TEXT,
    "skinType" "SkinType",
    "skinCondition" TEXT,
    "concerns" TEXT[],
    "allergies" TEXT,
    "contraindications" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facial_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facial_entries" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "sessionLabel" TEXT,
    "serviceId" TEXT,
    "zones" TEXT[],
    "productId" TEXT,
    "productName" TEXT,
    "lotNumber" TEXT,
    "quantity" DOUBLE PRECISION,
    "quantityUnit" TEXT,
    "technique" TEXT,
    "findings" TEXT,
    "homeCare" TEXT,
    "nextControl" TIMESTAMP(3),
    "nextControlTime" TEXT,
    "nextControlServiceId" TEXT,
    "nextControlAppointmentId" TEXT,
    "professionalSignature" TEXT,
    "patientSignature" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facial_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "facial_records_patientId_idx" ON "facial_records"("patientId");

-- CreateIndex
CREATE INDEX "facial_records_openedAt_idx" ON "facial_records"("openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "facial_entries_nextControlAppointmentId_key" ON "facial_entries"("nextControlAppointmentId");

-- CreateIndex
CREATE INDEX "facial_entries_recordId_idx" ON "facial_entries"("recordId");

-- AddForeignKey
ALTER TABLE "facial_records" ADD CONSTRAINT "facial_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_records" ADD CONSTRAINT "facial_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_entries" ADD CONSTRAINT "facial_entries_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "facial_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_entries" ADD CONSTRAINT "facial_entries_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_entries" ADD CONSTRAINT "facial_entries_nextControlServiceId_fkey" FOREIGN KEY ("nextControlServiceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_entries" ADD CONSTRAINT "facial_entries_nextControlAppointmentId_fkey" FOREIGN KEY ("nextControlAppointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facial_entries" ADD CONSTRAINT "facial_entries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
