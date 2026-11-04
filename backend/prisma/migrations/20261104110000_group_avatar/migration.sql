ALTER TABLE "Chat" ADD COLUMN "avatarId" TEXT;
CREATE UNIQUE INDEX "Chat_avatarId_key" ON "Chat"("avatarId");
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "UploadFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
