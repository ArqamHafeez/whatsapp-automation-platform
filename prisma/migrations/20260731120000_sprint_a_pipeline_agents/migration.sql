-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('relevance', 'clean', 'route', 'custom');

-- AlterTable Rule
ALTER TABLE "Rule" ADD COLUMN "pipelineAgentIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Rule" ADD COLUMN "pipelineFailOpen" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable Agent (table already exists from earlier migrations — migrate legacy columns)
ALTER TABLE "Agent" ADD COLUMN "systemPrompt" TEXT;
ALTER TABLE "Agent" ADD COLUMN "userPromptTemplate" TEXT;
ALTER TABLE "Agent" ADD COLUMN "model" TEXT;
ALTER TABLE "Agent" ADD COLUMN "structuredConfig" JSONB;
ALTER TABLE "Agent" ADD COLUMN "advancedPromptOverride" TEXT;
ALTER TABLE "Agent" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Agent" SET "isActive" = "isEnabled" WHERE "isEnabled" IS NOT NULL;

ALTER TABLE "Agent" DROP COLUMN IF EXISTS "template";
ALTER TABLE "Agent" DROP COLUMN IF EXISTS "defaultModel";
ALTER TABLE "Agent" DROP COLUMN IF EXISTS "isEnabled";

ALTER TABLE "Agent" ADD COLUMN "type_new" "AgentType";

UPDATE "Agent" SET "type_new" = CASE
  WHEN LOWER("type"::text) IN ('relevance', 'relevant') THEN 'relevance'::"AgentType"
  WHEN LOWER("type"::text) IN ('clean', 'cleaning') THEN 'clean'::"AgentType"
  WHEN LOWER("type"::text) IN ('route', 'routing') THEN 'route'::"AgentType"
  ELSE 'custom'::"AgentType"
END;

ALTER TABLE "Agent" DROP COLUMN "type";
ALTER TABLE "Agent" RENAME COLUMN "type_new" TO "type";
ALTER TABLE "Agent" ALTER COLUMN "type" SET NOT NULL;

-- AlterTable PipelineDecision
ALTER TABLE "PipelineDecision" ADD COLUMN "body" TEXT;
ALTER TABLE "PipelineDecision" ADD COLUMN "mediaUrl" TEXT;
ALTER TABLE "PipelineDecision" ADD COLUMN "pipelineMode" TEXT;
ALTER TABLE "PipelineDecision" ADD COLUMN "stepLogs" JSONB;
ALTER TABLE "PipelineDecision" ADD COLUMN "errorDetails" TEXT;

-- AddForeignKey PipelineDecision -> Rule (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PipelineDecision_ruleId_fkey'
  ) THEN
    ALTER TABLE "PipelineDecision"
      ADD CONSTRAINT "PipelineDecision_ruleId_fkey"
      FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX "Agent_orgId_idx" ON "Agent"("orgId");
CREATE INDEX "Agent_orgId_type_idx" ON "Agent"("orgId", "type");
CREATE INDEX "PipelineDecision_messageId_idx" ON "PipelineDecision"("messageId");
CREATE INDEX "PipelineDecision_ruleId_idx" ON "PipelineDecision"("ruleId");
CREATE INDEX "PipelineDecision_messageId_ruleId_idx" ON "PipelineDecision"("messageId", "ruleId");
