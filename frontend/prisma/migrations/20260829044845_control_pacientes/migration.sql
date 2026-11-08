-- CreateEnum
CREATE TYPE "CareType" AS ENUM ('TERAPIAS_CAPILARES', 'TRASPLANTE');

-- CreateTable
CREATE TABLE "clinical_records" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "procedureDate" TIMESTAMP(3) NOT NULL,
    "patientName" TEXT NOT NULL,
    "patientDocument" TEXT,
    "patientAge" INTEGER,
    "patientPhone" TEXT,
    "careType" "CareType" NOT NULL DEFAULT 'TERAPIAS_CAPILARES',
    "totalSessions" INTEGER,
    "transplantBeard" BOOLEAN NOT NULL DEFAULT false,
    "transplantEyebrows" BOOLEAN NOT NULL DEFAULT false,
    "transplantScalp" BOOLEAN NOT NULL DEFAULT false,
    "transplantZones" INTEGER[],
    "follicles" INTEGER,
    "folliclesLost" INTEGER,
    "warranty" TEXT,
    "markedZones" TEXT[],
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clinical_entries" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "controlLabel" TEXT,
    "alopeciaType" TEXT,
    "treatment" TEXT,
    "treatedZone" TEXT,
    "oralMedication" TEXT,
    "topicalMedication" TEXT,
    "shampoo" TEXT,
    "findings" TEXT,
    "nextControl" TIMESTAMP(3),
    "professionalSignature" TEXT,
    "patientSignature" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinical_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinical_records_patientId_idx" ON "clinical_records"("patientId");

-- CreateIndex
CREATE INDEX "clinical_records_procedureDate_idx" ON "clinical_records"("procedureDate");

-- CreateIndex
CREATE INDEX "clinical_entries_recordId_idx" ON "clinical_entries"("recordId");

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinical_entries" ADD CONSTRAINT "clinical_entries_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "clinical_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
