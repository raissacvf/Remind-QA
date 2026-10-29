ALTER TABLE "TestCase" ADD COLUMN "automationSteps" JSONB;

ALTER TABLE "TestExecution"
  ADD COLUMN "targetUrl" TEXT,
  ADD COLUMN "durationMs" INTEGER,
  ADD COLUMN "stepResults" JSONB,
  ADD COLUMN "failureMessage" TEXT;
