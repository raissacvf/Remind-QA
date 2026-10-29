import { describe, expect, it } from "vitest";
import { credentialsSchema } from "../src/schemas/auth";
import {
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from "../src/schemas/project";
import {
  createCycleSchema,
  createDefectSchema,
  createPathSchema,
  createTestCaseSchema,
  automationStepsSchema,
} from "../src/schemas/qa";

describe("credentialsSchema", () => {
  it("normaliza o e-mail para minúsculas", () => {
    const r = credentialsSchema.parse({ email: "  Ana@Exemplo.com ", password: "12345678" });
    expect(r.email).toBe("ana@exemplo.com");
  });
  it("rejeita e-mail inválido e senha curta", () => {
    expect(credentialsSchema.safeParse({ email: "x", password: "12345678" }).success).toBe(false);
    expect(credentialsSchema.safeParse({ email: "a@b.com", password: "123" }).success).toBe(false);
  });
});

describe("createProjectSchema", () => {
  it("aceita só o nome", () => {
    expect(createProjectSchema.safeParse({ name: "Meu projeto" }).success).toBe(true);
  });
  it("rejeita nome muito curto", () => {
    expect(createProjectSchema.safeParse({ name: "ab" }).success).toBe(false);
  });
});

describe("updateProjectSchema", () => {
  it("rejeita objeto vazio", () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
  });
  it("rejeita status inválido", () => {
    expect(updateProjectSchema.safeParse({ status: "XYZ" }).success).toBe(false);
  });
});

describe("listProjectsQuerySchema", () => {
  it("aplica padrões de paginação", () => {
    const r = listProjectsQuerySchema.parse({});
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(10);
  });

  describe("QA schemas", () => {
    const caseId = "clx1234567890123456789012";

    it("requires actionable steps and expected results for test cases", () => {
      expect(createTestCaseSchema.safeParse({ title: "Login", steps: "", expected: "" }).success).toBe(false);
      expect(createTestCaseSchema.safeParse({ title: "Login", steps: "Submit valid credentials", expected: "Dashboard opens" }).success).toBe(true);
    });

    it("rejects duplicated cases in a cycle or test path", () => {
      expect(createCycleSchema.safeParse({ name: "Sprint 1", testCaseIds: [caseId, caseId] }).success).toBe(false);
      expect(createPathSchema.safeParse({ name: "Purchase flow", testCaseIds: [caseId, caseId] }).success).toBe(false);
    });

    it("rejects cycles whose end date is before the start date", () => {
      expect(createCycleSchema.safeParse({
        name: "Sprint 1",
        startsAt: "2026-10-12",
        endsAt: "2026-10-10",
      }).success).toBe(false);
    });

    it("requires a test case or execution to link a bug", () => {
      expect(createDefectSchema.safeParse({ title: "Button broken", description: "Save does nothing" }).success).toBe(false);
      expect(createDefectSchema.safeParse({ title: "Button broken", description: "Save does nothing", testCaseId: caseId }).success).toBe(true);
    });

    it("accepts supported browser actions and limits each automation to 20 steps", () => {
      expect(automationStepsSchema.safeParse([
        { action: "goto", path: "/login" },
        { action: "fill", selector: "#email", value: "{{secret:email}}" },
        { action: "click", selector: "button[type=submit]" },
        { action: "expectVisible", selector: "#welcome" },
        { action: "expectText", text: "Bem-vinda" },
      ]).success).toBe(true);
      expect(automationStepsSchema.safeParse(
        Array.from({ length: 21 }, () => ({ action: "goto", path: "/" })),
      ).success).toBe(false);
    });
  });
  it("limita pageSize a 50", () => {
    expect(listProjectsQuerySchema.safeParse({ pageSize: "500" }).success).toBe(false);
  });
});
