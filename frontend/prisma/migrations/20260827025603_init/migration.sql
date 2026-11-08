-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PROFESIONAL', 'RECEPCION');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMENINO', 'MASCULINO', 'OTRO', 'NO_DECLARA');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVO', 'PAUSADO', 'FINALIZADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PROGRAMADA', 'COMPLETADA', 'REPROGRAMADA', 'CANCELADA', 'NO_ASISTIO');

-- CreateEnum
CREATE TYPE "PhotoType" AS ENUM ('ANTES', 'PROGRESO', 'DESPUES');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA', 'NO_ASISTIO');

-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('WEB', 'WHATSAPP', 'TELEFONO', 'PRESENCIAL');

-- CreateEnum
CREATE TYPE "InstagramMediaType" AS ENUM ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PROFESIONAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortDesc" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "priceCop" INTEGER,
    "sessionsAdvice" INTEGER,
    "category" TEXT NOT NULL DEFAULT 'Capilar',
    "imageUrl" TEXT,
    "icon" TEXT NOT NULL DEFAULT 'sparkles',
    "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "documentId" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "gender" "Gender" NOT NULL DEFAULT 'NO_DECLARA',
    "city" TEXT DEFAULT '',
    "medicalNotes" TEXT,
    "publicToken" TEXT NOT NULL,
    "photoConsent" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_plans" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT,
    "totalSessions" INTEGER NOT NULL DEFAULT 1,
    "intervalDays" INTEGER NOT NULL DEFAULT 21,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVO',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_sessions" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "sessionNumber" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "performedAt" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL DEFAULT 'PROGRAMADA',
    "professionalId" TEXT,
    "clinicalNotes" TEXT,
    "patientSummary" TEXT,
    "homeCare" TEXT,
    "productsUsed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_photos" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "PhotoType" NOT NULL DEFAULT 'PROGRESO',
    "angle" TEXT NOT NULL DEFAULT 'frontal',
    "caption" TEXT,
    "visibleToPatient" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "patientId" TEXT,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "message" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'PENDIENTE',
    "source" "AppointmentSource" NOT NULL DEFAULT 'WEB',
    "googleEventId" TEXT,
    "googleHtmlLink" TEXT,
    "manageToken" TEXT NOT NULL,
    "whatsappConfirmationSentAt" TIMESTAMP(3),
    "whatsappReminderSentAt" TIMESTAMP(3),
    "sessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_hours" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "breakStart" TEXT,
    "breakEnd" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blackouts" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "blackouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gallery_cases" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "serviceId" TEXT,
    "patientId" TEXT,
    "beforeUrl" TEXT NOT NULL,
    "afterUrl" TEXT NOT NULL,
    "beforeAlt" TEXT NOT NULL DEFAULT 'Antes del tratamiento',
    "afterAlt" TEXT NOT NULL DEFAULT 'Después del tratamiento',
    "sessionsCount" INTEGER,
    "durationLabel" TEXT,
    "consentSigned" BOOLEAN NOT NULL DEFAULT false,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gallery_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "city" TEXT DEFAULT '',
    "quote" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "handled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_tokens" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "accountId" TEXT,
    "accountName" TEXT,
    "lastRefreshedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "refreshCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instagram_posts" (
    "id" TEXT NOT NULL,
    "igId" TEXT NOT NULL,
    "caption" TEXT,
    "mediaType" "InstagramMediaType" NOT NULL DEFAULT 'IMAGE',
    "mediaUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "permalink" TEXT NOT NULL,
    "username" TEXT,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "instagram_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE INDEX "services_active_sortOrder_idx" ON "services"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "patients_documentId_key" ON "patients"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "patients_publicToken_key" ON "patients"("publicToken");

-- CreateIndex
CREATE INDEX "patients_fullName_idx" ON "patients"("fullName");

-- CreateIndex
CREATE INDEX "patients_phone_idx" ON "patients"("phone");

-- CreateIndex
CREATE INDEX "treatment_plans_patientId_status_idx" ON "treatment_plans"("patientId", "status");

-- CreateIndex
CREATE INDEX "treatment_sessions_scheduledAt_idx" ON "treatment_sessions"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_sessions_planId_sessionNumber_key" ON "treatment_sessions"("planId", "sessionNumber");

-- CreateIndex
CREATE INDEX "session_photos_sessionId_angle_idx" ON "session_photos"("sessionId", "angle");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_manageToken_key" ON "appointments"("manageToken");

-- CreateIndex
CREATE UNIQUE INDEX "appointments_sessionId_key" ON "appointments"("sessionId");

-- CreateIndex
CREATE INDEX "appointments_startsAt_status_idx" ON "appointments"("startsAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_dayOfWeek_key" ON "business_hours"("dayOfWeek");

-- CreateIndex
CREATE INDEX "blackouts_startsAt_endsAt_idx" ON "blackouts"("startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "gallery_cases_published_sortOrder_idx" ON "gallery_cases"("published", "sortOrder");

-- CreateIndex
CREATE INDEX "contact_messages_handled_createdAt_idx" ON "contact_messages"("handled", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "integration_tokens_provider_key" ON "integration_tokens"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "instagram_posts_igId_key" ON "instagram_posts"("igId");

-- CreateIndex
CREATE INDEX "instagram_posts_postedAt_idx" ON "instagram_posts"("postedAt");

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "treatment_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_sessions" ADD CONSTRAINT "treatment_sessions_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_photos" ADD CONSTRAINT "session_photos_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "treatment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_cases" ADD CONSTRAINT "gallery_cases_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gallery_cases" ADD CONSTRAINT "gallery_cases_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
