CREATE TYPE "TestCaseStatus" AS ENUM ('DRAFT', 'READY', 'DEPRECATED');
CREATE TYPE "TestCycleStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED');

ALTER TABLE "TestCase"
  ADD COLUMN "status" "TestCaseStatus" NOT NULL DEFAULT 'READY',
  ADD COLUMN "module" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "TestCase_projectId_status_idx" ON "TestCase"("projectId", "status");

CREATE TABLE "TestCycle" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "goal" TEXT,
  "status" "TestCycleStatus" NOT NULL DEFAULT 'PLANNED',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TestCycle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TestCycle_projectId_status_idx" ON "TestCycle"("projectId", "status");

CREATE TABLE "TestCycleCase" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "testCaseId" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TestCycleCase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TestCycleCase_cycleId_testCaseId_key" ON "TestCycleCase"("cycleId", "testCaseId");

CREATE TABLE "TestPath" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TestPath_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TestPath_projectId_idx" ON "TestPath"("projectId");

CREATE TABLE "TestPathStep" (
  "id" TEXT NOT NULL,
  "pathId" TEXT NOT NULL,
  "testCaseId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "note" TEXT,
  CONSTRAINT "TestPathStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TestPathStep_pathId_position_key" ON "TestPathStep"("pathId", "position");
CREATE INDEX "TestPathStep_testCaseId_idx" ON "TestPathStep"("testCaseId");

ALTER TABLE "TestExecution" ADD COLUMN "cycleId" TEXT;
CREATE INDEX "TestExecution_cycleId_executedAt_idx" ON "TestExecution"("cycleId", "executedAt");

ALTER TABLE "Defect"
  DROP CONSTRAINT "Defect_executionId_fkey",
  ALTER COLUMN "executionId" DROP NOT NULL,
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "testCaseId" TEXT,
  ADD COLUMN "actualResult" TEXT,
  ADD COLUMN "expectedResult" TEXT,
  ADD COLUMN "stepsToReproduce" TEXT,
  ADD COLUMN "environment" TEXT,
  ADD COLUMN "assignee" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "Defect_projectId_status_severity_idx" ON "Defect"("projectId", "status", "severity");

UPDATE "Defect" AS d
SET "projectId" = tc."projectId",
    "testCaseId" = tc."id"
FROM "TestExecution" AS e
JOIN "TestCase" AS tc ON tc."id" = e."testCaseId"
WHERE d."executionId" = e."id";

ALTER TABLE "TestCycle" ADD CONSTRAINT "TestCycle_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestCycleCase" ADD CONSTRAINT "TestCycleCase_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "TestCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestCycleCase" ADD CONSTRAINT "TestCycleCase_testCaseId_fkey"
  FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestPath" ADD CONSTRAINT "TestPath_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestPathStep" ADD CONSTRAINT "TestPathStep_pathId_fkey"
  FOREIGN KEY ("pathId") REFERENCES "TestPath"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestPathStep" ADD CONSTRAINT "TestPathStep_testCaseId_fkey"
  FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "TestCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_testCaseId_fkey"
  FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Defect" ADD CONSTRAINT "Defect_executionId_fkey"
  FOREIGN KEY ("executionId") REFERENCES "TestExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
