CREATE TYPE "ChatMemberRole" AS ENUM ('OWNER', 'MEMBER');
ALTER TABLE "Chat" ADD COLUMN "name" VARCHAR(100);
ALTER TABLE "ChatParticipant" ADD COLUMN "role" "ChatMemberRole" NOT NULL DEFAULT 'MEMBER',
  ADD COLUMN "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "ChatParticipant_chatId_idx" ON "ChatParticipant"("chatId");
-- Existing groups receive a stable name and one owner; direct chats stay unchanged.
UPDATE "Chat" SET "name" = 'Group' WHERE "isGroup" = true;
UPDATE "ChatParticipant" p SET "role" = 'OWNER'
FROM (SELECT MIN(p2."id") AS id FROM "ChatParticipant" p2
JOIN "Chat" c ON c.id = p2."chatId" WHERE c."isGroup" = true GROUP BY p2."chatId") owners
WHERE p.id = owners.id;
