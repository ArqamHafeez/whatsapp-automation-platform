-- Add one WhatsApp instance per forwarding rule
ALTER TABLE "Rule" ADD COLUMN "connectionId" TEXT;

UPDATE "Rule" r
SET "connectionId" = sub."connectionId"
FROM (
  SELECT r2.id AS "ruleId", (
    SELECT c."connectionId"
    FROM "Chat" c
    WHERE c.id = ANY(r2."sourceChatIds")
    LIMIT 1
  ) AS "connectionId"
  FROM "Rule" r2
) sub
WHERE r.id = sub."ruleId" AND sub."connectionId" IS NOT NULL;

UPDATE "Rule" r
SET "connectionId" = sub."connectionId"
FROM (
  SELECT r2.id AS "ruleId", (
    SELECT c."connectionId"
    FROM "Chat" c
    WHERE c.id = ANY(r2."destinationChatIds")
    LIMIT 1
  ) AS "connectionId"
  FROM "Rule" r2
  WHERE r2."connectionId" IS NULL
) sub
WHERE r.id = sub."ruleId" AND sub."connectionId" IS NOT NULL;

DELETE FROM "Rule" WHERE "connectionId" IS NULL;

ALTER TABLE "Rule" ALTER COLUMN "connectionId" SET NOT NULL;

ALTER TABLE "Rule" ADD CONSTRAINT "Rule_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "whatsapp_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Rule_connectionId_idx" ON "Rule"("connectionId");
