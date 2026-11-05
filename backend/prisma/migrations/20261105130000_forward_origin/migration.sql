ALTER TABLE "Message" ADD COLUMN "forwardedFromId" INTEGER;
ALTER TABLE "Message" ADD CONSTRAINT "Message_forwardedFromId_fkey" FOREIGN KEY ("forwardedFromId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
