// Requer PostgreSQL rodando e migrações aplicadas (veja o README).
import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";

const app = createApp();
const run = Date.now();
const emailA = `a-${run}@teste.local`;
const emailB = `b-${run}@teste.local`;
const password = "senha-segura-123";

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: [emailA, emailB] } } });
  const ids = users.map((u) => u.id);
  await prisma.project.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("autenticação e projetos", () => {
  const a = request.agent(app);
  const b = request.agent(app);
  let projectId = "";

  it("bloqueia acesso sem login", async () => {
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(401);
  });

  it("registra usuários e impede e-mail repetido", async () => {
    const registration = await a.post("/api/auth/register").send({ email: emailA, password });
    expect(registration.status).toBe(201);
    const cookies = registration.headers["set-cookie"] as string[];
    expect(cookies.some((cookie) => cookie.startsWith("remindqa_token="))).toBe(true);
    const token = cookies.find((cookie) => cookie.startsWith("remindqa_token="))?.split(";")[0].split("=")[1];
    expect(token).toBeTruthy();
    expect((await request(app).get("/api/auth/me").set("Cookie", `reqmind_token=${token}`)).status).toBe(200);
    expect((await b.post("/api/auth/register").send({ email: emailB, password })).status).toBe(201);
    expect((await request(app).post("/api/auth/register").send({ email: emailA, password })).status).toBe(409);
  });

  it("rejeita senha errada", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: emailA, password: "errada-errada" });
    expect(res.status).toBe(401);
  });

  it("cria projeto e valida entrada", async () => {
    const bad = await a.post("/api/projects").send({ name: "x" });
    expect(bad.status).toBe(400);
    const ok = await a.post("/api/projects").send({ name: "Projeto Alfa", objective: "Testar" });
    expect(ok.status).toBe(201);
    projectId = ok.body.id;
  });

  it("lista, pesquisa e filtra apenas projetos do próprio usuário", async () => {
    const mine = await a.get("/api/projects").query({ q: "alfa" });
    expect(mine.body.total).toBe(1);
    const theirs = await b.get("/api/projects");
    expect(theirs.body.total).toBe(0);
  });

  it("isola dados: outro usuário recebe 404", async () => {
    expect((await b.get(`/api/projects/${projectId}`)).status).toBe(404);
    expect((await b.patch(`/api/projects/${projectId}`).send({ name: "Invadido" })).status).toBe(404);
    expect((await b.post(`/api/projects/${projectId}/archive`)).status).toBe(404);
  });

  it("edita e arquiva o próprio projeto", async () => {
    const edit = await a.patch(`/api/projects/${projectId}`).send({ name: "Projeto Beta" });
    expect(edit.body.name).toBe("Projeto Beta");
    const arch = await a.post(`/api/projects/${projectId}/archive`);
    expect(arch.body.status).toBe("ARCHIVED");
    const active = await a.get("/api/projects").query({ status: "ACTIVE" });
    expect(active.body.total).toBe(0);
  });
});
