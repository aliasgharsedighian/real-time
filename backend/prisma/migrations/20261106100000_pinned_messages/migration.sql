ALTER TABLE "Message" ADD COLUMN "pinnedAt" TIMESTAMP(3);

CREATE INDEX "Message_pinned_by_chat_idx"
ON "Message" ("chatId", "pinnedAt" DESC, "id" DESC)
WHERE "pinnedAt" IS NOT NULL;
