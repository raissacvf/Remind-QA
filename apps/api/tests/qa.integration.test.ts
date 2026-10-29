import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo, Server } from "node:http";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";

const app = createApp();
const email = `qa-${Date.now()}@teste.local`;
const otherEmail = `qa-other-${Date.now()}@teste.local`;
const password = "senha-segura-123";
const agent = request.agent(app);
let projectId = "";
let testCaseId = "";
let cycleId = "";
let executionId = "";
let targetServer: Server;
let targetUrl = "";

beforeAll(async () => {
  targetServer = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <form>
        <label>E-mail <input id="email" /></label>
        <label>Senha <input id="password" type="password" /></label>
        <button id="submit" type="button">Entrar</button>
      </form>
      <p id="result"></p>
      <script>
        document.querySelector("#submit").addEventListener("click", () => {
          const valid = document.querySelector("#email").value === "qa@example.test"
            && document.querySelector("#password").value === "senha-de-teste";
          document.querySelector("#result").textContent = valid ? "Aprovada" : "Recusada";
        });
      </script>`);
  });
  await new Promise<void>((resolve, reject) => {
    targetServer.once("error", reject);
    targetServer.listen(0, "127.0.0.1", resolve);
  });
  const address = targetServer.address() as AddressInfo;
  targetUrl = new URL(`http://127.0.0.1:${address.port}`).toString();
  await agent.post("/api/auth/register").send({ email, password });
  const project = await agent.post("/api/projects").send({ name: "Projeto QA" });
  projectId = project.body.id;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => targetServer.close((error) => error ? reject(error) : resolve()));
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const projects = await prisma.project.findMany({ where: { userId: user.id }, select: { id: true } });
    const ids = projects.map(({ id }) => id);
    await prisma.defect.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.testExecution.deleteMany({ where: { testCase: { projectId: { in: ids } } } });
    await prisma.testCase.deleteMany({ where: { projectId: { in: ids } } });
    await prisma.project.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.user.deleteMany({ where: { email: otherEmail } });
  await prisma.$disconnect();
});

describe("validação QA do RemindQA", () => {
  it("valida o fluxo de teste: cadastro, ciclo, resultado, bug, jornada e indicadores", async () => {
    const base = `/api/projects/${projectId}/qa`;
    const createdCase = await agent.post(`${base}/test-cases`).send({
      title: "Validar login", steps: "Abrir login e autenticar", expected: "Acessar painel",
      priority: "HIGH", module: "Autenticação",
      automationSteps: [
        { action: "goto", path: "/" },
        { action: "fill", selector: "#email", value: "{{secret:email}}" },
        { action: "fill", selector: "#password", value: "{{secret:senha}}" },
        { action: "click", selector: "#submit" },
        { action: "expectText", text: "Aprovada" },
      ],
    });
    expect(createdCase.status).toBe(201);
    expect(createdCase.body.code).toBe("TC-001");
    testCaseId = createdCase.body.id;

    const createdCycle = await agent.post(`${base}/cycles`).send({
      name: "Regressão 1", goal: "Validar autenticação", testCaseIds: [testCaseId],
    });
    expect(createdCycle.status).toBe(201);
    cycleId = createdCycle.body.id;

    const execution = await agent.post(`${base}/cycles/${cycleId}/test-cases/${testCaseId}/run`).send({
      baseUrl: targetUrl,
      secrets: { email: "qa@example.test", senha: "senha-de-teste" },
    });
    expect(execution.status).toBe(201);
    expect(execution.body.cycleId).toBe(cycleId);
    expect(execution.body.result).toBe("PASSED");
    expect(execution.body.stepResults).toHaveLength(6);
    expect(execution.body.stepResults.every((step: { status: string }) => step.status === "PASSED")).toBe(true);
    expect(execution.body.targetUrl).toBe(targetUrl);
    expect(JSON.stringify(execution.body)).not.toContain("senha-de-teste");
    executionId = execution.body.id;

    const failedExecution = await agent.post(`${base}/test-cases/${testCaseId}/run`).send({
      baseUrl: targetUrl,
      secrets: { email: "qa@example.test", senha: "senha-incorreta" },
    });
    expect(failedExecution.status).toBe(201);
    expect(failedExecution.body.result).toBe("FAILED");
    expect(failedExecution.body.stepResults.at(-1).status).toBe("FAILED");
    expect(JSON.stringify(failedExecution.body)).not.toContain("senha-incorreta");

    const blockedHost = await agent.post(`${base}/test-cases/${testCaseId}/run`).send({
      baseUrl: "https://unapproved.invalid",
      secrets: { email: "qa@example.test", senha: "senha-de-teste" },
    });
    expect(blockedHost.status).toBe(403);
    const urlWithCredentials = await agent.post(`${base}/test-cases/${testCaseId}/run`).send({
      baseUrl: "http://user:password@localhost",
      secrets: { email: "qa@example.test", senha: "senha-de-teste" },
    });
    expect(urlWithCredentials.status).toBe(400);

    const defect = await agent.post(`${base}/defects`).send({
      title: "Login retorna erro", description: "Credenciais válidas são recusadas",
      severity: "HIGH", testCaseId, executionId: execution.body.id,
    });
    expect(defect.status).toBe(201);
    expect((await agent.get(`${base}/defects`)).body).toHaveLength(1);

    const path = await agent.post(`${base}/paths`).send({
      name: "Jornada de login", testCaseIds: [testCaseId],
    });
    expect(path.status).toBe(201);
    expect(path.body.steps[0].position).toBe(1);

    const overview = await agent.get(`${base}/overview`);
    expect(overview.status).toBe(200);
    expect(overview.body.executions[0]._count._all).toBe(1);
    expect((await agent.get(`${base}/test-cases`)).body[0].code).toBe("TC-001");

    await agent.patch(`${base}/cycles/${cycleId}`).send({ status: "COMPLETED" });
    expect((await agent.post(`${base}/cycles/${cycleId}/executions`).send({
      testCaseId, result: "PASSED",
    })).status).toBe(409);
    expect((await agent.post(`${base}/cycles/${cycleId}/cases`).send({ testCaseId })).status).toBe(409);
  }, 60_000);

  it("impede defeitos inconsistentes e novas execuções em ciclos encerrados", async () => {
    const base = `/api/projects/${projectId}/qa`;
    const createdCase = await agent.post(`${base}/test-cases`).send({
      title: "Validar recuperação de senha",
      steps: "Solicitar redefinição de senha",
      expected: "Receber link de redefinição",
    });
    expect(createdCase.status).toBe(201);
    const testCase = createdCase.body as { id: string };

    const cycle = await agent.post(`${base}/cycles`).send({
      name: "Ciclo de encerramento",
      testCaseIds: [testCase.id],
    });
    expect(cycle.status).toBe(201);

    await agent.patch(`${base}/cycles/${cycle.body.id}`).send({ status: "COMPLETED" });
    expect((await agent.post(`${base}/cycles/${cycle.body.id}/executions`).send({
      testCaseId: testCase.id,
      result: "PASSED",
    })).status).toBe(409);

    const execution = await agent.post(`${base}/executions`).send({
      testCaseId: testCase.id,
      result: "FAILED",
    });
    expect(execution.status).toBe(201);
    expect((await agent.post(`${base}/defects`).send({
      title: "Defeito vinculado ao teste errado",
      description: "A execução pertence a outro caso de teste",
      testCaseId: testCase.id,
      executionId,
    })).status).toBe(400);
  }, 30_000);

  it("valida isolamento entre usuários e bloqueia alterações em projeto arquivado", async () => {
    const other = request.agent(app);
    await other.post("/api/auth/register").send({ email: otherEmail, password });
    expect((await other.get(`/api/projects/${projectId}/qa/test-cases`)).status).toBe(404);
    await agent.post(`/api/projects/${projectId}/archive`);
    expect((await agent.post(`/api/projects/${projectId}/qa/test-cases`).send({
      title: "Outro caso", steps: "Abrir", expected: "Funciona",
    })).status).toBe(409);
  }, 30_000);
});
