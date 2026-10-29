// Requer PostgreSQL com migrações aplicadas (veja o README).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";

const app = createApp();
const run = Date.now();
const emailA = `ra-${run}@teste.local`;
const emailB = `rb-${run}@teste.local`;
const password = "senha-segura-123";

const a = request.agent(app);
const b = request.agent(app);
let projectId = "";
let reqId = "";

const base = {
  title: "Login com e-mail",
  description: "O usuário deve entrar com e-mail e senha.",
  type: "FUNCTIONAL",
};

beforeAll(async () => {
  await a.post("/api/auth/register").send({ email: emailA, password });
  await b.post("/api/auth/register").send({ email: emailB, password });
  const p = await a.post("/api/projects").send({ name: "Projeto de requisitos" });
  projectId = p.body.id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: [emailA, emailB] } } });
  const userIds = users.map((u) => u.id);
  const projects = await prisma.project.findMany({ where: { userId: { in: userIds } } });
  const projectIds = projects.map((p) => p.id);
  const reqs = await prisma.requirement.findMany({ where: { projectId: { in: projectIds } } });
  await prisma.requirementHistory.deleteMany({ where: { requirementId: { in: reqs.map((r) => r.id) } } });
  await prisma.requirement.deleteMany({ where: { projectId: { in: projectIds } } });
  await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("requisitos", () => {
  it("cria com código sequencial e status RASCUNHO", async () => {
    const r1 = await a.post(`/api/projects/${projectId}/requirements`).send(base);
    const r2 = await a.post(`/api/projects/${projectId}/requirements`).send({ ...base, title: "Logout seguro" });
    expect(r1.status).toBe(201);
    expect(r1.body.code).toBe("REQ-001");
    expect(r1.body.status).toBe("DRAFT");
    expect(r2.body.code).toBe("REQ-002");
    reqId = r1.body.id;
  });

  it("valida entrada", async () => {
    const res = await a.post(`/api/projects/${projectId}/requirements`).send({ ...base, title: "ab" });
    expect(res.status).toBe(400);
  });

  it("registra histórico apenas do que mudou", async () => {
    await a.patch(`/api/projects/${projectId}/requirements/${reqId}`).send({ priority: "HIGH", title: base.title });
    const res = await a.get(`/api/projects/${projectId}/requirements/${reqId}`);
    const fields = res.body.history.map((h: { field: string }) => h.field);
    expect(fields).toContain("priority");
    expect(fields).not.toContain("title");
  });

  it("respeita as transições de status", async () => {
    const bad = await a.patch(`/api/projects/${projectId}/requirements/${reqId}`).send({ status: "APPROVED" });
    expect(bad.status).toBe(409);
    expect((await a.patch(`/api/projects/${projectId}/requirements/${reqId}`).send({ status: "IN_REVIEW" })).status).toBe(200);
    expect((await a.patch(`/api/projects/${projectId}/requirements/${reqId}`).send({ status: "APPROVED" })).status).toBe(200);
  });

  it("filtra e pesquisa", async () => {
    const byStatus = await a.get(`/api/projects/${projectId}/requirements`).query({ status: "APPROVED" });
    expect(byStatus.body.total).toBe(1);
    const byText = await a.get(`/api/projects/${projectId}/requirements`).query({ q: "logout" });
    expect(byText.body.total).toBe(1);
  });

  it("isola dados: outro usuário recebe 404", async () => {
    expect((await b.get(`/api/projects/${projectId}/requirements`)).status).toBe(404);
    expect((await b.get(`/api/projects/${projectId}/requirements/${reqId}`)).status).toBe(404);
    expect((await b.post(`/api/projects/${projectId}/requirements`).send(base)).status).toBe(404);
  });

  it("exclusão lógica remove da lista e preserva os dados", async () => {
    expect((await a.delete(`/api/projects/${projectId}/requirements/${reqId}`)).status).toBe(204);
    expect((await a.get(`/api/projects/${projectId}/requirements/${reqId}`)).status).toBe(404);
    const stored = await prisma.requirement.findUnique({ where: { id: reqId } });
    expect(stored?.deletedAt).not.toBeNull();
  });

  it("não cria requisito em projeto arquivado", async () => {
    await a.post(`/api/projects/${projectId}/archive`);
    const res = await a.post(`/api/projects/${projectId}/requirements`).send(base);
    expect(res.status).toBe(409);
  });
});
