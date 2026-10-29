import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const testCaseStatusSchema = z.enum(["DRAFT", "READY", "DEPRECATED"]);
export const testCycleStatusSchema = z.enum(["PLANNED", "IN_PROGRESS", "COMPLETED"]);
export const executionResultSchema = z.enum(["PASSED", "FAILED", "BLOCKED", "NOT_EXECUTED"]);
export const severitySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const defectStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]);

const gotoStepSchema = z.object({ action: z.literal("goto"), path: z.string().trim().min(1).max(500) });
const fillStepSchema = z.object({
  action: z.literal("fill"),
  selector: z.string().trim().min(1).max(500),
  value: z.string().max(1000),
});
const clickStepSchema = z.object({ action: z.literal("click"), selector: z.string().trim().min(1).max(500) });
const expectVisibleStepSchema = z.object({ action: z.literal("expectVisible"), selector: z.string().trim().min(1).max(500) });
const expectTextStepSchema = z.object({ action: z.literal("expectText"), text: z.string().trim().min(1).max(1000) });
const automationStepSchema = z.discriminatedUnion("action", [
  gotoStepSchema,
  fillStepSchema,
  clickStepSchema,
  expectVisibleStepSchema,
  expectTextStepSchema,
]);

export const automationStepsSchema = z.array(automationStepSchema).max(20);

export const createTestCaseSchema = z.object({
  title: z.string().trim().min(3).max(200),
  objective: optionalText(2000),
  preconditions: optionalText(2000),
  testData: optionalText(2000),
  steps: z.string().trim().min(1).max(10000),
  expected: z.string().trim().min(1).max(5000),
  type: z.string().trim().min(1).max(50).default("functional"),
  priority: severitySchema.default("MEDIUM"),
  status: testCaseStatusSchema.default("READY"),
  module: optionalText(100),
  requirementId: z.string().cuid().nullable().optional(),
  automationSteps: automationStepsSchema.nullable().optional(),
});

export const updateTestCaseSchema = createTestCaseSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Informe ao menos um campo para atualizar",
);

export const createCycleSchema = z.object({
  name: z.string().trim().min(3).max(150),
  goal: optionalText(2000),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
  testCaseIds: z.array(z.string().cuid()).max(200).default([]),
}).refine((value) => new Set(value.testCaseIds).size === value.testCaseIds.length, {
  message: "Um caso de teste não pode aparecer duas vezes no mesmo ciclo",
  path: ["testCaseIds"],
}).refine((value) => !value.startsAt || !value.endsAt || value.endsAt >= value.startsAt, {
  message: "A data final do ciclo não pode ser anterior à data inicial",
  path: ["endsAt"],
});

export const updateCycleSchema = z.object({
  name: z.string().trim().min(3).max(150).optional(),
  goal: optionalText(2000),
  status: testCycleStatusSchema.optional(),
  startsAt: z.coerce.date().nullable().optional(),
  endsAt: z.coerce.date().nullable().optional(),
}).refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar");

export const createExecutionSchema = z.object({
  testCaseId: z.string().cuid(),
  result: executionResultSchema,
  notes: optionalText(5000),
  evidence: optionalText(2000),
  executor: optionalText(120),
});

export const runTestCaseSchema = z.object({
  baseUrl: z.string().trim().url().max(2000),
  secrets: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/), z.string().max(500)).default({}),
});

export const createDefectSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(3).max(5000),
  severity: severitySchema.default("MEDIUM"),
  testCaseId: z.string().cuid().nullable().optional(),
  executionId: z.string().cuid().nullable().optional(),
  actualResult: optionalText(5000),
  expectedResult: optionalText(5000),
  stepsToReproduce: optionalText(5000),
  environment: optionalText(500),
  assignee: optionalText(120),
}).refine((value) => value.testCaseId || value.executionId, {
  message: "Vincule o bug a um caso ou execução de teste",
  path: ["testCaseId"],
});

export const updateDefectSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(3).max(5000).optional(),
  severity: severitySchema.optional(),
  status: defectStatusSchema.optional(),
  actualResult: optionalText(5000),
  expectedResult: optionalText(5000),
  stepsToReproduce: optionalText(5000),
  environment: optionalText(500),
  assignee: optionalText(120),
}).refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar");

export const createPathSchema = z.object({
  name: z.string().trim().min(3).max(150),
  description: optionalText(2000),
  testCaseIds: z.array(z.string().cuid()).max(100).default([]),
}).refine((value) => new Set(value.testCaseIds).size === value.testCaseIds.length, {
  message: "Um caso de teste não pode aparecer duas vezes no mesmo fluxo",
  path: ["testCaseIds"],
});

export const updatePathSchema = z.object({
  name: z.string().trim().min(3).max(150).optional(),
  description: optionalText(2000),
  testCaseIds: z.array(z.string().cuid()).max(100).optional(),
}).refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo para atualizar")
  .refine((value) => !value.testCaseIds || new Set(value.testCaseIds).size === value.testCaseIds.length, {
    message: "Um caso de teste não pode aparecer duas vezes no mesmo fluxo",
    path: ["testCaseIds"],
  });
