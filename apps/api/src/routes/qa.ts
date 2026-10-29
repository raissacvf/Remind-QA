import { Router } from "express";
import type { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { chromium } from "playwright";
import type { Page } from "playwright";
import { config, qaAllowedHosts } from "../config";
import { prisma } from "../db";
import { AppError, asyncHandler } from "../errors";
import { findOwnedProject } from "../lib/ownership";
import { requireAuth } from "../middlewares/auth";
import { z } from "zod";
import {
  createCycleSchema,
  createDefectSchema,
  createExecutionSchema,
  createPathSchema,
  createTestCaseSchema,
  automationStepsSchema,
  defectStatusSchema,
  severitySchema,
  runTestCaseSchema,
  testCaseStatusSchema,
  updateCycleSchema,
  updateDefectSchema,
  updatePathSchema,
  updateTestCaseSchema,
} from "../schemas/qa";

export const qaRouter = Router({ mergeParams: true });
qaRouter.use(requireAuth);

async function ownedProject(projectId: string, userId: string) {
  const project = await findOwnedProject(projectId, userId);
  return project;
}

async function writableProject(projectId: string, userId: string) {
  const project = await ownedProject(projectId, userId);
  if (project.status === "ARCHIVED") throw new AppError(409, "Projeto arquivado: não é possível alterar dados de QA");
  return project;
}

async function findTestCase(projectId: string, id: string) {
  const testCase = await prisma.testCase.findFirst({ where: { id, projectId, deletedAt: null } });
  if (!testCase) throw new AppError(404, "Caso de teste não encontrado");
  return testCase;
}

async function validateTestCaseIds(projectId: string, ids: string[]) {
  if (ids.length === 0) return;
  const count = await prisma.testCase.count({ where: { projectId, id: { in: ids }, deletedAt: null } });
  if (count !== ids.length) throw new AppError(400, "Um ou mais casos de teste não pertencem a este projeto");
}

function validateTargetUrl(value: string) {
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    throw new AppError(400, "Informe uma URL válida para o ambiente de teste");
  }
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password || target.search || target.hash) {
    throw new AppError(400, "Use uma URL HTTP/HTTPS sem credenciais, parâmetros ou fragmento");
  }
  const hostname = target.hostname.toLowerCase();
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(hostname);
  if (!qaAllowedHosts.has(hostname) && !(config.NODE_ENV !== "production" && isLocalhost)) {
    throw new AppError(403, "Este host não está autorizado para automação. Configure QA_ALLOWED_HOSTS na API");
  }
  if (config.NODE_ENV === "production" && target.protocol !== "https:") {
    throw new AppError(400, "Ambientes de teste em produção exigem HTTPS");
  }
  return target;
}

function isAllowedBrowserRequest(value: string) {
  let requestUrl: URL;
  try {
    requestUrl = new URL(value);
  } catch {
    return false;
  }
  if (["data:", "blob:", "about:"].includes(requestUrl.protocol)) return true;
  if (!["http:", "https:"].includes(requestUrl.protocol)) return false;
  const hostname = requestUrl.hostname.toLowerCase();
  return qaAllowedHosts.has(hostname) ||
    (config.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "::1"].includes(hostname));
}

type AutomationStep = z.infer<typeof automationStepsSchema>[number];
type StepResult = {
  position: number;
  action: string;
  status: "PASSED" | "FAILED";
  durationMs: number;
  message: string;
};

async function performAutomationStep(page: Page, step: AutomationStep, baseUrl: URL, secrets: Record<string, string>) {
  const selector = "selector" in step && typeof step.selector === "string" ? step.selector : "";
  switch (step.action) {
    case "goto": {
      if (typeof step.path !== "string" || step.path.startsWith("//")) throw new AppError(400, "Navegação deve usar um caminho relativo ao ambiente");
      const destination = new URL(step.path, baseUrl);
      if (destination.origin !== baseUrl.origin) throw new AppError(400, "O fluxo só pode navegar dentro da URL autorizada");
      await page.goto(destination.toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
      return "Página carregada";
    }
    case "fill": {
      if (!selector || typeof step.value !== "string") throw new AppError(400, "Passo de preenchimento inválido");
      const secretMatch = /^\{\{secret:([a-zA-Z][a-zA-Z0-9_-]{0,39})\}\}$/.exec(step.value);
      const value = secretMatch ? secrets[secretMatch[1]] : step.value;
      if (value === undefined) throw new AppError(400, `Informe o valor secreto "${secretMatch?.[1]}" para executar o caso`);
      await page.locator(selector).first().fill(value, { timeout: 10_000 });
      return secretMatch ? "Campo secreto preenchido" : "Campo preenchido";
    }
    case "click":
      if (!selector) throw new AppError(400, "Passo de clique inválido");
      await page.locator(selector).first().click({ timeout: 10_000 });
      return "Elemento clicado";
    case "expectVisible":
      if (!selector) throw new AppError(400, "Passo de verificação inválido");
      await page.locator(selector).first().waitFor({ state: "visible", timeout: 10_000 });
      return "Elemento visível";
    case "expectText":
      if (typeof step.text !== "string" || !step.text) throw new AppError(400, "Texto esperado inválido");
      await page.getByText(step.text, { exact: false }).first().waitFor({ state: "visible", timeout: 10_000 });
      return "Texto esperado encontrado";
    default:
      throw new AppError(400, "Ação de automação não suportada");
  }
}

async function runTestCase(req: Request, res: Response, cycleId?: string) {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const testCase = await findTestCase(projectId, req.params.testCaseId);
  if (testCase.status === "DEPRECATED") throw new AppError(409, "Não é possível executar um caso descontinuado");
  if (!testCase.automationSteps || !Array.isArray(testCase.automationSteps) || testCase.automationSteps.length === 0) {
    throw new AppError(409, "Configure ao menos uma ação automática no caso antes de executá-lo");
  }
  const body = runTestCaseSchema.parse(req.body);
  const baseUrl = validateTargetUrl(body.baseUrl);
  const stepDefinitions = automationStepsSchema.parse(testCase.automationSteps);
  const requiredSecrets = [...new Set(stepDefinitions.flatMap((step) => {
    if (step.action !== "fill" || typeof step.value !== "string") return [];
    const match = /^\{\{secret:([a-zA-Z][a-zA-Z0-9_-]{0,39})\}\}$/.exec(step.value);
    return match ? [match[1]] : [];
  }))];
  const missingSecret = requiredSecrets.find((name) => !body.secrets[name]);
  if (missingSecret) throw new AppError(400, `Informe o valor secreto "${missingSecret}" para executar o caso`);

  if (cycleId) {
    const cycle = await prisma.testCycle.findFirst({ where: { id: cycleId, projectId } });
    if (!cycle) throw new AppError(404, "Ciclo de teste não encontrado");
    if (cycle.status === "COMPLETED") throw new AppError(409, "Não é possível executar um caso em um ciclo concluído");
    const membership = await prisma.testCycleCase.findUnique({
      where: { cycleId_testCaseId: { cycleId, testCaseId: testCase.id } },
    });
    if (!membership) throw new AppError(400, "Adicione o caso ao ciclo antes de executá-lo");
  }

  const startedAt = Date.now();
  const stepResults: StepResult[] = [];
  let result: "PASSED" | "FAILED" = "PASSED";
  let failureMessage: string | null = null;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.route("**/*", async (route) => {
      if (isAllowedBrowserRequest(route.request().url())) await route.continue();
      else await route.abort("blockedbyclient");
    });
    const navigationStartedAt = Date.now();
    try {
      await page.goto(baseUrl.toString(), { waitUntil: "domcontentloaded", timeout: 15_000 });
      stepResults.push({
        position: 0,
        action: "openBaseUrl",
        status: "PASSED",
        durationMs: Date.now() - navigationStartedAt,
        message: "URL base carregada",
      });
    } catch (error) {
      result = "FAILED";
      failureMessage = error instanceof Error ? error.message.slice(0, 1000) : "Não foi possível abrir a URL base";
      stepResults.push({
        position: 0,
        action: "openBaseUrl",
        status: "FAILED",
        durationMs: Date.now() - navigationStartedAt,
        message: failureMessage,
      });
    }
    for (const [index, step] of stepDefinitions.entries()) {
      if (result === "FAILED") break;
      const stepStartedAt = Date.now();
      try {
        const message = await performAutomationStep(page, step, baseUrl, body.secrets);
        stepResults.push({ position: index + 1, action: step.action, status: "PASSED", durationMs: Date.now() - stepStartedAt, message });
      } catch (error) {
        result = "FAILED";
        failureMessage = error instanceof Error ? error.message.slice(0, 1000) : "Falha desconhecida durante a automação";
        stepResults.push({ position: index + 1, action: step.action, status: "FAILED", durationMs: Date.now() - stepStartedAt, message: failureMessage });
        break;
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }

  const user = await prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true } });
  if (!user) throw new AppError(401, "Usuário não encontrado");
  const execution = await prisma.testExecution.create({
    data: {
      testCaseId: testCase.id,
      cycleId,
      result,
      executor: user.email,
      targetUrl: baseUrl.toString(),
      durationMs: Date.now() - startedAt,
      stepResults: stepResults as Prisma.InputJsonValue,
      failureMessage,
      notes: result === "PASSED"
        ? `${stepResults.length} passos automáticos passaram.`
        : `Falha no passo ${stepResults.find((step) => step.status === "FAILED")?.position ?? "desconhecido"}.`,
    },
    include: { testCase: { select: { id: true, code: true, title: true } }, cycle: { select: { id: true, name: true } } },
  });
  if (cycleId) {
    const cycle = await prisma.testCycle.findUnique({ where: { id: cycleId }, select: { status: true } });
    if (cycle?.status === "PLANNED") {
      await prisma.testCycle.update({ where: { id: cycleId }, data: { status: "IN_PROGRESS" } });
    }
  }
  res.status(201).json(execution);
}

qaRouter.get("/overview", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await ownedProject(projectId, req.userId!);
  const [testCases, cycles, executions, defects, recentExecutions] = await Promise.all([
    prisma.testCase.groupBy({
      by: ["status"],
      where: { projectId, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.testCycle.groupBy({ by: ["status"], where: { projectId }, _count: { _all: true } }),
    prisma.testExecution.groupBy({
      by: ["result"],
      where: { testCase: { projectId } },
      _count: { _all: true },
    }),
    prisma.defect.count({
      where: { OR: [{ projectId }, { testCase: { projectId } }, { execution: { testCase: { projectId } } }] },
    }),
    prisma.testExecution.findMany({
      where: { testCase: { projectId } },
      include: { testCase: { select: { id: true, code: true, title: true } }, cycle: { select: { id: true, name: true } } },
      orderBy: { executedAt: "desc" },
      take: 8,
    }),
  ]);
  res.json({ testCases, cycles, executions, defectCount: defects, recentExecutions });
}));

qaRouter.get("/test-cases", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await ownedProject(projectId, req.userId!);
  const status = req.query.status ? testCaseStatusSchema.parse(req.query.status) : undefined;
  const priority = req.query.priority ? severitySchema.parse(req.query.priority) : undefined;
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  const where: Prisma.TestCaseWhereInput = {
    projectId,
    deletedAt: null,
    ...(status && { status }),
    ...(priority && { priority }),
    ...(q && { OR: [
      { title: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
      { module: { contains: q, mode: "insensitive" } },
    ] }),
  };
  const data = await prisma.testCase.findMany({
    where,
    include: { requirement: { select: { id: true, code: true, title: true } }, _count: { select: { executions: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(data);
}));

qaRouter.post("/test-cases", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const body = createTestCaseSchema.parse(req.body);
  if (body.requirementId) {
    const requirement = await prisma.requirement.findFirst({ where: { id: body.requirementId, projectId, deletedAt: null } });
    if (!requirement) throw new AppError(400, "O requisito informado não pertence a este projeto");
  }
  const testCase = await prisma.$transaction(async (tx) => {
    const { tcCounter } = await tx.project.update({
      where: { id: projectId },
      data: { tcCounter: { increment: 1 } },
      select: { tcCounter: true },
    });
    const data = {
      ...body,
      automationSteps: body.automationSteps === null ? Prisma.JsonNull : body.automationSteps,
      projectId,
      code: `TC-${String(tcCounter).padStart(3, "0")}`,
    } satisfies Prisma.TestCaseUncheckedCreateInput;
    return tx.testCase.create({ data });
  });
  res.status(201).json(testCase);
}));

qaRouter.patch("/test-cases/:testCaseId", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const current = await findTestCase(projectId, req.params.testCaseId);
  const body = updateTestCaseSchema.parse(req.body);
  if (body.requirementId) {
    const requirement = await prisma.requirement.findFirst({ where: { id: body.requirementId, projectId, deletedAt: null } });
    if (!requirement) throw new AppError(400, "O requisito informado não pertence a este projeto");
  }
  const { requirementId, automationSteps, ...fields } = body;
  const data = {
    ...fields,
    ...(requirementId !== undefined && {
      requirement: requirementId === null ? { disconnect: true } : { connect: { id: requirementId } },
    }),
    ...(automationSteps !== undefined && {
      automationSteps: automationSteps === null ? Prisma.JsonNull : automationSteps,
    }),
  } satisfies Prisma.TestCaseUpdateInput;
  res.json(await prisma.testCase.update({ where: { id: current.id }, data }));
}));

qaRouter.delete("/test-cases/:testCaseId", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const current = await findTestCase(projectId, req.params.testCaseId);
  await prisma.testCase.update({ where: { id: current.id }, data: { deletedAt: new Date(), status: "DEPRECATED" } });
  res.status(204).end();
}));

qaRouter.post("/test-cases/:testCaseId/run", asyncHandler(async (req, res) => {
  await runTestCase(req, res);
}));

qaRouter.get("/cycles", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await ownedProject(projectId, req.userId!);
  const data = await prisma.testCycle.findMany({
    where: { projectId },
    include: {
      testCases: { where: { testCase: { deletedAt: null } }, include: { testCase: { select: { id: true, code: true, title: true, priority: true } } } },
      executions: { select: { result: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(data);
}));

qaRouter.post("/cycles", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const body = createCycleSchema.parse(req.body);
  await validateTestCaseIds(projectId, body.testCaseIds);
  const data = await prisma.testCycle.create({
    data: {
      projectId,
      name: body.name,
      goal: body.goal,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      testCases: { create: body.testCaseIds.map((testCaseId) => ({ testCaseId })) },
    },
    include: { testCases: { include: { testCase: true } } },
  });
  res.status(201).json(data);
}));

qaRouter.patch("/cycles/:cycleId", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const cycle = await prisma.testCycle.findFirst({ where: { id: req.params.cycleId, projectId } });
  if (!cycle) throw new AppError(404, "Ciclo de teste não encontrado");
  res.json(await prisma.testCycle.update({ where: { id: cycle.id }, data: updateCycleSchema.parse(req.body) }));
}));

qaRouter.post("/cycles/:cycleId/cases", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const cycle = await prisma.testCycle.findFirst({ where: { id: req.params.cycleId, projectId } });
  if (!cycle) throw new AppError(404, "Ciclo de teste não encontrado");
  if (cycle.status === "COMPLETED") throw new AppError(409, "Não é possível adicionar casos a um ciclo concluído");
  const testCaseId = z.string().cuid().parse(req.body.testCaseId);
  await validateTestCaseIds(projectId, [testCaseId]);
  const link = await prisma.testCycleCase.upsert({
    where: { cycleId_testCaseId: { cycleId: cycle.id, testCaseId } },
    create: { cycleId: cycle.id, testCaseId },
    update: {},
  });
  res.status(201).json(link);
}));

qaRouter.delete("/cycles/:cycleId/cases/:testCaseId", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const cycle = await prisma.testCycle.findFirst({ where: { id: req.params.cycleId, projectId } });
  if (!cycle) throw new AppError(404, "Ciclo de teste não encontrado");
  await prisma.testCycleCase.deleteMany({ where: { cycleId: cycle.id, testCaseId: req.params.testCaseId } });
  res.status(204).end();
}));

qaRouter.post("/cycles/:cycleId/executions", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const cycle = await prisma.testCycle.findFirst({ where: { id: req.params.cycleId, projectId } });
  if (!cycle) throw new AppError(404, "Ciclo de teste não encontrado");
  if (cycle.status === "COMPLETED") throw new AppError(409, "Não é possível registrar execuções em um ciclo concluído");
  const body = createExecutionSchema.parse(req.body);
  await findTestCase(projectId, body.testCaseId);
  const member = await prisma.testCycleCase.findUnique({
    where: { cycleId_testCaseId: { cycleId: cycle.id, testCaseId: body.testCaseId } },
  });
  if (!member) throw new AppError(400, "Adicione o caso ao ciclo antes de executá-lo");
  const execution = await prisma.$transaction(async (tx) => {
    if (cycle.status === "PLANNED") {
      await tx.testCycle.update({ where: { id: cycle.id }, data: { status: "IN_PROGRESS" } });
    }
    return tx.testExecution.create({ data: { ...body, cycleId: cycle.id } });
  });
  res.status(201).json(execution);
}));

qaRouter.post("/cycles/:cycleId/test-cases/:testCaseId/run", asyncHandler(async (req, res) => {
  await runTestCase(req, res, req.params.cycleId);
}));

qaRouter.get("/executions", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await ownedProject(projectId, req.userId!);
  const data = await prisma.testExecution.findMany({
    where: { testCase: { projectId } },
    include: {
      testCase: { select: { id: true, code: true, title: true } },
      cycle: { select: { id: true, name: true } },
      defects: { select: { id: true, title: true, severity: true, status: true } },
    },
    orderBy: { executedAt: "desc" },
    take: 200,
  });
  res.json(data);
}));

qaRouter.post("/executions", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const body = createExecutionSchema.parse(req.body);
  await findTestCase(projectId, body.testCaseId);
  res.status(201).json(await prisma.testExecution.create({ data: body }));
}));

qaRouter.get("/defects", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await ownedProject(projectId, req.userId!);
  const status = req.query.status ? defectStatusSchema.parse(req.query.status) : undefined;
  const severity = req.query.severity ? severitySchema.parse(req.query.severity) : undefined;
  const data = await prisma.defect.findMany({
    where: {
      OR: [{ projectId }, { testCase: { projectId } }, { execution: { testCase: { projectId } } }],
      ...(status && { status }),
      ...(severity && { severity }),
    },
    include: {
      testCase: { select: { id: true, code: true, title: true } },
      execution: { select: { id: true, result: true, executedAt: true } },
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  res.json(data);
}));

qaRouter.post("/defects", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const body = createDefectSchema.parse(req.body);
  if (body.testCaseId) await findTestCase(projectId, body.testCaseId);
  if (body.executionId) {
    const execution = await prisma.testExecution.findFirst({
      where: { id: body.executionId, testCase: { projectId } },
    });
    if (!execution) throw new AppError(400, "A execução informada não pertence a este projeto");
    if (body.testCaseId && execution.testCaseId !== body.testCaseId) {
      throw new AppError(400, "O caso de teste não corresponde à execução informada");
    }
  }
  res.status(201).json(await prisma.defect.create({ data: { ...body, projectId } }));
}));

qaRouter.patch("/defects/:defectId", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const defect = await prisma.defect.findFirst({
    where: {
      id: req.params.defectId,
      OR: [{ projectId }, { testCase: { projectId } }, { execution: { testCase: { projectId } } }],
    },
  });
  if (!defect) throw new AppError(404, "Bug não encontrado");
  res.json(await prisma.defect.update({ where: { id: defect.id }, data: updateDefectSchema.parse(req.body) }));
}));

qaRouter.get("/paths", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await ownedProject(projectId, req.userId!);
  const data = await prisma.testPath.findMany({
    where: { projectId },
    include: {
      steps: {
        orderBy: { position: "asc" },
        include: { testCase: { select: { id: true, code: true, title: true, priority: true, status: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
  res.json(data);
}));

qaRouter.post("/paths", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const body = createPathSchema.parse(req.body);
  await validateTestCaseIds(projectId, body.testCaseIds);
  const path = await prisma.testPath.create({
    data: {
      projectId,
      name: body.name,
      description: body.description,
      steps: { create: body.testCaseIds.map((testCaseId, index) => ({ testCaseId, position: index + 1 })) },
    },
    include: { steps: { orderBy: { position: "asc" }, include: { testCase: true } } },
  });
  res.status(201).json(path);
}));

qaRouter.patch("/paths/:pathId", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const path = await prisma.testPath.findFirst({ where: { id: req.params.pathId, projectId } });
  if (!path) throw new AppError(404, "Fluxo de teste não encontrado");
  const body = updatePathSchema.parse(req.body);
  if (body.testCaseIds) await validateTestCaseIds(projectId, body.testCaseIds);
  await prisma.$transaction(async (tx) => {
    if (body.testCaseIds) {
      await tx.testPathStep.deleteMany({ where: { pathId: path.id } });
      await tx.testPathStep.createMany({
        data: body.testCaseIds.map((testCaseId, index) => ({ pathId: path.id, testCaseId, position: index + 1 })),
      });
    }
    await tx.testPath.update({ where: { id: path.id }, data: { name: body.name, description: body.description } });
  });
  res.json(await prisma.testPath.findUnique({
    where: { id: path.id },
    include: { steps: { orderBy: { position: "asc" }, include: { testCase: true } } },
  }));
}));

qaRouter.delete("/paths/:pathId", asyncHandler(async (req, res) => {
  const projectId = req.params.projectId;
  await writableProject(projectId, req.userId!);
  const path = await prisma.testPath.findFirst({ where: { id: req.params.pathId, projectId } });
  if (!path) throw new AppError(404, "Fluxo de teste não encontrado");
  await prisma.testPath.delete({ where: { id: path.id } });
  res.status(204).end();
}));
