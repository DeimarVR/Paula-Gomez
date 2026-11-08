-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "signature" TEXT,
ADD COLUMN     "signedBy" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "signature" TEXT;
