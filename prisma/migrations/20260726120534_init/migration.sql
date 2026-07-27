/*
  Warnings:

  - The `status` column on the `ReviewItem` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `reviewMode` column on the `Rule` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[messageId,destinationChatId]` on the table `SendLog` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `type` on the `Agent` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `decisionType` on the `PipelineDecision` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `agentType` on the `RulePipelineStep` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('text', 'image', 'document', 'video', 'audio', 'unknown');

-- AlterTable
ALTER TABLE "Agent" DROP COLUMN "type",
ADD COLUMN     "type" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PipelineDecision" DROP COLUMN "decisionType",
ADD COLUMN     "decisionType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ReviewItem" DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Rule" DROP COLUMN "reviewMode",
ADD COLUMN     "reviewMode" TEXT NOT NULL DEFAULT 'on_escalation';

-- AlterTable
ALTER TABLE "RulePipelineStep" DROP COLUMN "agentType",
ADD COLUMN     "agentType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "SendLog" ADD COLUMN     "sentAt" TIMESTAMP(3);

-- DropEnum
DROP TYPE "AgentType";

-- DropEnum
DROP TYPE "DecisionType";

-- DropEnum
DROP TYPE "ReviewMode";

-- DropEnum
DROP TYPE "ReviewStatus";

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "body" TEXT,
    "type" "MessageType" NOT NULL DEFAULT 'text',
    "mediaUrl" TEXT,
    "metadata" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_chatId_connectionId_idx" ON "Message"("chatId", "connectionId");

-- CreateIndex
CREATE INDEX "Message_receivedAt_idx" ON "Message"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_waMessageId_connectionId_key" ON "Message"("waMessageId", "connectionId");

-- CreateIndex
CREATE INDEX "SendLog_status_nextAttemptAt_idx" ON "SendLog"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "SendLog_messageId_destinationChatId_key" ON "SendLog"("messageId", "destinationChatId");

-- AddForeignKey
ALTER TABLE "SendLog" ADD CONSTRAINT "SendLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
