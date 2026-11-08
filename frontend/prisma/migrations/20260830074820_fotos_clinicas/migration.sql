/*
  Warnings:

  - You are about to drop the `gallery_cases` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "gallery_cases" DROP CONSTRAINT "gallery_cases_patientId_fkey";

-- DropForeignKey
ALTER TABLE "gallery_cases" DROP CONSTRAINT "gallery_cases_serviceId_fkey";

-- DropTable
DROP TABLE "gallery_cases";

-- CreateTable
CREATE TABLE "photo_records" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "serviceId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "consentSigned" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "photo_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_record_items" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "PhotoType" NOT NULL DEFAULT 'PROGRESO',
    "angle" TEXT NOT NULL DEFAULT 'frontal',
    "caption" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_record_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "photo_records_patientId_createdAt_idx" ON "photo_records"("patientId", "createdAt");

-- CreateIndex
CREATE INDEX "photo_record_items_recordId_sortOrder_idx" ON "photo_record_items"("recordId", "sortOrder");

-- AddForeignKey
ALTER TABLE "photo_records" ADD CONSTRAINT "photo_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_records" ADD CONSTRAINT "photo_records_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_records" ADD CONSTRAINT "photo_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_record_items" ADD CONSTRAINT "photo_record_items_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "photo_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
