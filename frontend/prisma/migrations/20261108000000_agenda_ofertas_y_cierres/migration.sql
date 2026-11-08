-- Agenda de una sola cita, ofertas de horario liberado y cierre de días.
--
-- Todo es aditivo: columnas nuevas con valor por defecto y dos tablas nuevas.
-- Ninguna fila existente cambia de significado. Cada sentencia se puede correr
-- dos veces sin romper nada (IF NOT EXISTS, o un bloque que ignora el «ya
-- existe»): así da igual si el script se pega en la consola y después corre
-- `prisma migrate deploy`, o al revés.
--
-- Ojo con la consola de Railway: le agrega un LIMIT a cualquier script donde
-- aparezca la palabra de consulta, incluso en un comentario. Por eso aquí no
-- aparece.

-- Citas que el centro canceló al cerrar un día y que el paciente debe reagendar.
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "needsReschedule" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "closureNoticeSentAt" TIMESTAMP(3);

-- Día completo cerrado desde el panel: uno por fecha.
ALTER TABLE "blackouts" ADD COLUMN IF NOT EXISTS "dateKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "blackouts_dateKey_key" ON "blackouts"("dateKey");

-- Ofertas de horario liberado.
DO $$ BEGIN
  CREATE TYPE "SlotOfferStatus" AS ENUM ('ABIERTA', 'TOMADA', 'VENCIDA', 'ANULADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "slot_offers" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "SlotOfferStatus" NOT NULL DEFAULT 'ABIERTA',
    "sourceAppointmentId" TEXT,
    "takenByAppointmentId" TEXT,
    "takenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slot_offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "slot_offers_status_startsAt_idx" ON "slot_offers"("status", "startsAt");

CREATE TABLE IF NOT EXISTS "slot_offer_invites" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slot_offer_invites_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "slot_offer_invites_token_key" ON "slot_offer_invites"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "slot_offer_invites_offerId_appointmentId_key" ON "slot_offer_invites"("offerId", "appointmentId");
CREATE INDEX IF NOT EXISTS "slot_offer_invites_appointmentId_idx" ON "slot_offer_invites"("appointmentId");

DO $$ BEGIN
  ALTER TABLE "slot_offer_invites" ADD CONSTRAINT "slot_offer_invites_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "slot_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "slot_offer_invites" ADD CONSTRAINT "slot_offer_invites_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
