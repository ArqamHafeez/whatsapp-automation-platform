-- AlterTable
ALTER TABLE "Chat" ADD COLUMN "maxSendsPerHour" INTEGER;
ALTER TABLE "Chat" ADD COLUMN "maxSendsPerDay" INTEGER;

-- CreateIndex
CREATE INDEX "SendLog_destinationChatId_status_sentAt_idx" ON "SendLog"("destinationChatId", "status", "sentAt");
