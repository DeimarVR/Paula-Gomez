-- Expediente general: qué se trata, medicación, antecedentes, notas de
-- evolución y fotos de las hojas en papel.
-- Sin la palabra de consulta en mayúsculas en ninguna parte: la consola de
-- Railway le pega un LIMIT a cualquier script que la contenga.

ALTER TABLE "patients"
  ADD COLUMN IF NOT EXISTS "consultReason" TEXT,
  ADD COLUMN IF NOT EXISTS "diagnosis" TEXT,
  ADD COLUMN IF NOT EXISTS "carePlan" TEXT,
  ADD COLUMN IF NOT EXISTS "plannedControls" INTEGER,
  ADD COLUMN IF NOT EXISTS "controlsSince" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "allergies" TEXT,
  ADD COLUMN IF NOT EXISTS "surgicalHistory" TEXT,
  ADD COLUMN IF NOT EXISTS "familyHistory" TEXT,
  ADD COLUMN IF NOT EXISTS "clinicalUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "clinicalUpdatedBy" TEXT;

CREATE TABLE IF NOT EXISTS "patient_medications" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dose" TEXT,
  "notes" TEXT,
  "startedOn" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "endedOn" TIMESTAMP(3),
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "patient_medications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "patient_medications_patientId_active_idx" ON "patient_medications"("patientId", "active");

CREATE TABLE IF NOT EXISTS "evolution_notes" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "noteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorId" TEXT,
  "authorName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "evolution_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "evolution_notes_patientId_noteDate_idx" ON "evolution_notes"("patientId", "noteDate");

CREATE TABLE IF NOT EXISTS "paper_sheets" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "sheetDate" TIMESTAMP(3),
  "fileUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "notes" TEXT,
  "uploadedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "paper_sheets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "paper_sheets_patientId_createdAt_idx" ON "paper_sheets"("patientId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "patient_medications" ADD CONSTRAINT "patient_medications_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "evolution_notes" ADD CONSTRAINT "evolution_notes_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "paper_sheets" ADD CONSTRAINT "paper_sheets_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- La categoría por defecto de un tratamiento venía del centro anterior.
ALTER TABLE "services" ALTER COLUMN "category" SET DEFAULT 'General';
