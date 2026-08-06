-- Rule routing: junction tables -> sourceChatIds / destinationChatIds on Rule (matches schema.prisma)

ALTER TABLE "Rule" ADD COLUMN "sourceChatIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Rule" ADD COLUMN "destinationChatIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Rule" r
SET "sourceChatIds" = COALESCE(
  (SELECT array_agg(rs."chatId" ORDER BY rs."chatId") FROM "RuleSource" rs WHERE rs."ruleId" = r.id),
  ARRAY[]::TEXT[]
);

UPDATE "Rule" r
SET "destinationChatIds" = COALESCE(
  (SELECT array_agg(rd."chatId" ORDER BY rd."chatId") FROM "RuleDestination" rd WHERE rd."ruleId" = r.id),
  ARRAY[]::TEXT[]
);

ALTER TABLE "Rule" ALTER COLUMN "sourceChatIds" DROP DEFAULT;
ALTER TABLE "Rule" ALTER COLUMN "destinationChatIds" DROP DEFAULT;

DROP TABLE "RuleDestination";
DROP TABLE "RuleSource";
