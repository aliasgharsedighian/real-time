CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "installationId" VARCHAR(100) NOT NULL,
    "token" VARCHAR(4096) NOT NULL,
    "userId" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PushSubscription_installationId_key" ON "PushSubscription"("installationId");
CREATE UNIQUE INDEX "PushSubscription_token_key" ON "PushSubscription"("token");
CREATE INDEX "PushSubscription_userId_updatedAt_idx" ON "PushSubscription"("userId", "updatedAt");
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
