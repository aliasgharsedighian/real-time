ALTER TABLE "ChatParticipant" ADD COLUMN "muted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Message" ADD COLUMN "editedAt" TIMESTAMP(3), ADD COLUMN "forwarded" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "replyToId" INTEGER;
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");
