ALTER TABLE "Message" ADD COLUMN "reactionVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "MessageReaction" (
    "messageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "emoji" VARCHAR(32) NOT NULL,
    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("messageId", "userId"),
    CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MessageReaction_userId_idx" ON "MessageReaction"("userId");
