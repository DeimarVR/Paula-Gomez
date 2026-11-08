-- CreateTable
CREATE TABLE "consent_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileUrl" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consent_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signed_consents" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "patientId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "patientName" TEXT NOT NULL,
    "patientDocument" TEXT,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "professionalName" TEXT,
    "signedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signed_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ConsentTemplateToService" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ConsentTemplateToService_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "consent_templates_active_name_idx" ON "consent_templates"("active", "name");

-- CreateIndex
CREATE INDEX "signed_consents_patientId_signedAt_idx" ON "signed_consents"("patientId", "signedAt");

-- CreateIndex
CREATE INDEX "_ConsentTemplateToService_B_index" ON "_ConsentTemplateToService"("B");

-- AddForeignKey
ALTER TABLE "consent_templates" ADD CONSTRAINT "consent_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_consents" ADD CONSTRAINT "signed_consents_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "consent_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_consents" ADD CONSTRAINT "signed_consents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signed_consents" ADD CONSTRAINT "signed_consents_signedById_fkey" FOREIGN KEY ("signedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConsentTemplateToService" ADD CONSTRAINT "_ConsentTemplateToService_A_fkey" FOREIGN KEY ("A") REFERENCES "consent_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConsentTemplateToService" ADD CONSTRAINT "_ConsentTemplateToService_B_fkey" FOREIGN KEY ("B") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
