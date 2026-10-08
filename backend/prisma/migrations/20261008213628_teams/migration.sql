DELETE FROM "Invitation";
/*
  Warnings:

  - You are about to drop the column `conversationId` on the `Invitation` table. All the data in the column will be lost.
  - Added the required column `teamId` to the `Invitation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TeamRole" AS ENUM ('CEO', 'COACH', 'PLAYER');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('DIRECT', 'GENERAL', 'ADMIN', 'EVENT');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SCRIM', 'MATCH');

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_conversationId_fkey";

-- DropIndex
DROP INDEX "Invitation_conversationId_status_idx";

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "type" "ConversationType" NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "Invitation" DROP COLUMN "conversationId",
ADD COLUMN     "teamId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "role" "TeamRole" NOT NULL DEFAULT 'PLAYER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "opponent" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "conversationId" TEXT,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_conversationId_key" ON "Event"("conversationId");

-- CreateIndex
CREATE INDEX "Event_teamId_startsAt_idx" ON "Event"("teamId", "startsAt");

-- CreateIndex
CREATE INDEX "Invitation_teamId_status_idx" ON "Invitation"("teamId", "status");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Conversion des anciens groupes en équipes
-- ============================================================

-- 1. Chaque groupe devient une équipe, avec le même id.
--    Son ADMIN devient propriétaire (à défaut, le membre le plus ancien).
INSERT INTO "Team" ("id", "name", "createdAt", "ownerId")
SELECT DISTINCT ON (c."id")
  c."id",
  COALESCE(NULLIF(TRIM(c."name"), ''), 'Équipe'),
  c."createdAt",
  m."userId"
FROM "Conversation" c
JOIN "Membership" m ON m."conversationId" = c."id"
WHERE c."isGroup" = true
ORDER BY c."id", (m."role" = 'ADMIN') DESC, m."joinedAt" ASC;

-- 2. Les membres du groupe deviennent membres de l'équipe (propriétaire = CEO)
INSERT INTO "TeamMember" ("id", "role", "joinedAt", "teamId", "userId")
SELECT
  gen_random_uuid()::text,
  CASE WHEN m."userId" = t."ownerId" THEN 'CEO'::"TeamRole" ELSE 'PLAYER'::"TeamRole" END,
  m."joinedAt",
  t."id",
  m."userId"
FROM "Team" t
JOIN "Membership" m ON m."conversationId" = t."id";

-- 3. L'ancien groupe devient le salon #général de son équipe (messages conservés)
UPDATE "Conversation"
SET "type" = 'GENERAL', "teamId" = "id", "name" = 'général'
WHERE "id" IN (SELECT "id" FROM "Team");

-- 4. Groupes vides (sans aucun membre) : supprimés
DELETE FROM "Conversation" WHERE "isGroup" = true AND "teamId" IS NULL;