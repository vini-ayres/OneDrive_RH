ALTER TABLE "document_accesses" DROP CONSTRAINT IF EXISTS "document_accesses_message_id_fkey";

ALTER TABLE "document_accesses"
  ADD CONSTRAINT "document_accesses_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL;
