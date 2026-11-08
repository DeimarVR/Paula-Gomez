-- El consentimiento pasa de ser un PDF subido a ser texto en la base de datos.
-- Las plantillas que existan se quedan con el cuerpo vacío: hay que escribirlas
-- desde el panel. No se pierde ningún consentimiento ya firmado, porque cada
-- firmado guarda su propio PDF y su propia copia del nombre y la versión.
ALTER TABLE "consent_templates" ADD COLUMN "body" TEXT NOT NULL DEFAULT '';
ALTER TABLE "consent_templates" ALTER COLUMN "body" DROP DEFAULT;
ALTER TABLE "consent_templates" DROP COLUMN "fileUrl";
