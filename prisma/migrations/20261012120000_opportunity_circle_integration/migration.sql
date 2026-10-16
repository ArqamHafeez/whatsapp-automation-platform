-- CreateTable
CREATE TABLE "opportunity_circle_integrations" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "connectionId" TEXT NOT NULL,
    "keyHash" TEXT,
    "sinkChatIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primarySinkChatId" TEXT,
    "categoryByRuleId" JSONB NOT NULL DEFAULT '{}',
    "defaultCategory" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_circle_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_circle_integrations_orgId_key" ON "opportunity_circle_integrations"("orgId");

-- CreateIndex
CREATE INDEX "opportunity_circle_integrations_connectionId_idx" ON "opportunity_circle_integrations"("connectionId");

-- AddForeignKey
ALTER TABLE "opportunity_circle_integrations" ADD CONSTRAINT "opportunity_circle_integrations_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_circle_integrations" ADD CONSTRAINT "opportunity_circle_integrations_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "whatsapp_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
