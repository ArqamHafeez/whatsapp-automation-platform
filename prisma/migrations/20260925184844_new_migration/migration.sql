/*
  Warnings:

  - You are about to drop the `AgentExample` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OutboundJob` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RulePipelineStep` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AgentExample" DROP CONSTRAINT "AgentExample_agentId_fkey";

-- DropForeignKey
ALTER TABLE "OutboundJob" DROP CONSTRAINT "OutboundJob_sendLogId_fkey";

-- DropForeignKey
ALTER TABLE "RulePipelineStep" DROP CONSTRAINT "RulePipelineStep_ruleId_fkey";

-- DropTable
DROP TABLE "AgentExample";

-- DropTable
DROP TABLE "OutboundJob";

-- DropTable
DROP TABLE "RulePipelineStep";

-- AddForeignKey
ALTER TABLE "SendLog" ADD CONSTRAINT "SendLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
