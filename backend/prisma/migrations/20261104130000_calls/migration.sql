CREATE TABLE "Call" (
  "id" TEXT NOT NULL,
  "chatId" INTEGER NOT NULL,
  "callerId" INTEGER NOT NULL,
  "calleeId" INTEGER NOT NULL,
  "mode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'RINGING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answeredAt" TIMESTAMP(3),
  "connectedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  CONSTRAINT "Call_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Call_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Call_callerId_createdAt_idx" ON "Call"("callerId", "createdAt");
CREATE INDEX "Call_calleeId_createdAt_idx" ON "Call"("calleeId", "createdAt");
