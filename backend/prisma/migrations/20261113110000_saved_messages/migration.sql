ALTER TABLE "Chat" ADD COLUMN "savedOwnerId" INTEGER;
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_savedOwnerId_fkey"
    FOREIGN KEY ("savedOwnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_saved_not_group"
    CHECK ("savedOwnerId" IS NULL OR NOT "isGroup");
CREATE UNIQUE INDEX "Chat_savedOwnerId_key" ON "Chat"("savedOwnerId");

ALTER TABLE "Message" ADD COLUMN "savedFromId" INTEGER;
ALTER TABLE "Message" ADD CONSTRAINT "Message_savedFromId_fkey"
    FOREIGN KEY ("savedFromId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Message_savedFromId_idx" ON "Message"("savedFromId");
