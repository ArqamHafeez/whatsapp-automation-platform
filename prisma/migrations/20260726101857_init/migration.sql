-- CreateEnum
CREATE TYPE "ChatType" AS ENUM ('CHAT', 'GROUP', 'CHANNEL');

-- CreateEnum
CREATE TYPE "ReviewMode" AS ENUM ('off', 'on_escalation', 'always');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('RELEVANCE', 'CLEANING', 'ROUTING', 'WATERMARK');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('forward', 'hold_for_review', 'drop', 'forward_on_pipeline_error');

-- CreateEnum
CREATE TYPE "SendStatus" AS ENUM ('pending', 'sent', 'failed', 'forwarded_on_pipeline_error');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected', 'auto_forwarded');

-- CreateTable
CREATE TABLE "whatsapp_connections" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "qrCodeUrl" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "externalChatId" TEXT NOT NULL,
    "type" "ChatType" NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "isSource" BOOLEAN NOT NULL DEFAULT false,
    "isDestination" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reviewMode" "ReviewMode" NOT NULL DEFAULT 'on_escalation',
    "reviewTimeoutMinutes" INTEGER NOT NULL DEFAULT 1440,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSource" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,

    CONSTRAINT "RuleSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleDestination" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,

    CONSTRAINT "RuleDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RulePipelineStep" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "agentType" "AgentType" NOT NULL,
    "agentId" TEXT,

    CONSTRAINT "RulePipelineStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "type" "AgentType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "template" TEXT NOT NULL,
    "defaultModel" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentExample" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "output" TEXT NOT NULL,

    CONSTRAINT "AgentExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineDecision" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "decisionType" "DecisionType" NOT NULL,
    "destinations" TEXT[],
    "reviewReason" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SendLog" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "sourceMessageId" TEXT NOT NULL,
    "destinationChatId" TEXT NOT NULL,
    "ruleId" TEXT,
    "status" "SendStatus" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "errorDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SendLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "originalPayload" TEXT NOT NULL,
    "reviewNotes" TEXT,
    "reviewerId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundJob" (
    "id" TEXT NOT NULL,
    "sendLogId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_connections_externalId_key" ON "whatsapp_connections"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_connections_orgId_externalId_key" ON "whatsapp_connections"("orgId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Chat_connectionId_externalChatId_key" ON "Chat"("connectionId", "externalChatId");

-- AddForeignKey
ALTER TABLE "whatsapp_connections" ADD CONSTRAINT "whatsapp_connections_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "whatsapp_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSource" ADD CONSTRAINT "RuleSource_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSource" ADD CONSTRAINT "RuleSource_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleDestination" ADD CONSTRAINT "RuleDestination_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleDestination" ADD CONSTRAINT "RuleDestination_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RulePipelineStep" ADD CONSTRAINT "RulePipelineStep_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentExample" ADD CONSTRAINT "AgentExample_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboundJob" ADD CONSTRAINT "OutboundJob_sendLogId_fkey" FOREIGN KEY ("sendLogId") REFERENCES "SendLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
