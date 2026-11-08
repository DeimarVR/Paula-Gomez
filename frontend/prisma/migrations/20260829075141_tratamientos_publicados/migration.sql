/*
  Warnings:

  - A unique constraint covering the columns `[nextControlAppointmentId]` on the table `clinical_entries` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "clinical_entries" ADD COLUMN     "nextControlAppointmentId" TEXT,
ADD COLUMN     "nextControlServiceId" TEXT,
ADD COLUMN     "nextControlTime" TEXT;

-- AlterTable
ALTER TABLE "services" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "clinical_entries_nextControlAppointmentId_key" ON "clinical_entries"("nextControlAppointmentId");

-- AddForeignKey
ALTER TABLE "clinical_entries" ADD CONSTRAINT "clinical_entries_nextControlServiceId_fkey" FOREIGN KEY ("nextControlServiceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_entries" ADD CONSTRAINT "clinical_entries_nextControlAppointmentId_fkey" FOREIGN KEY ("nextControlAppointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
