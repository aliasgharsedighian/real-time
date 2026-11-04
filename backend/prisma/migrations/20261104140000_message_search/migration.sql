CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Supports bounded history/context traversal as well as chat-scoped search.
CREATE INDEX "Message_chatId_id_idx" ON "Message" ("chatId", "id");

-- Prisma cannot express a partial trigram index; keep this in the migration.
CREATE INDEX "Message_text_search_trgm_idx" ON "Message"
USING GIN ("content" gin_trgm_ops) WHERE "kind" = 'TEXT';
