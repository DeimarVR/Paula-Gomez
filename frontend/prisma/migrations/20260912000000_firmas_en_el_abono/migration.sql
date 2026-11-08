-- Cada abono guarda quién entregó el dinero y quién lo recibió, firmado.
--
-- Tres columnas nuevas en `payments`, todas opcionales: un abono que ya existe
-- no tiene firmas y así se queda. Nada se borra ni se cambia de valor.
--
-- Opcionales también hacia adelante, a propósito: una transferencia que entra
-- de noche se registra igual y queda señalada como sin firmar. Bloquearla
-- hasta que el paciente venga a firmar dejaría la caja descuadrada mientras
-- tanto, que es peor que un abono con una marca.
--
-- Sin consultas de lectura, ni siquiera en los comentarios: la consola de
-- Railway le añade un LIMIT al final a cualquier script donde detecte una, y
-- entonces no se ejecuta nada.

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "patientSignature" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "receivedSignature" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "receivedBy" TEXT;
