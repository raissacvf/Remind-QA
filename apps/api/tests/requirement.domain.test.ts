import { describe, expect, it } from "vitest";
import { canTransition, formatCode } from "../src/domain/requirement";
import {
  createRequirementSchema,
  listRequirementsQuerySchema,
  updateRequirementSchema,
} from "../src/schemas/requirement";

describe("formatCode", () => {
  it("preenche com zeros", () => {
    expect(formatCode("REQ", 1)).toBe("REQ-001");
    expect(formatCode("REQ", 42)).toBe("REQ-042");
    expect(formatCode("CT", 1000)).toBe("CT-1000");
  });
});

describe("canTransition", () => {
  it("permite o fluxo normal", () => {
    expect(canTransition("DRAFT", "IN_REVIEW")).toBe(true);
    expect(canTransition("IN_REVIEW", "APPROVED")).toBe(true);
  });
  it("não permite aprovar direto do rascunho nem de rejeitado", () => {
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
    expect(canTransition("REJECTED", "APPROVED")).toBe(false);
  });
  it("manter o mesmo status é permitido", () => {
    expect(canTransition("APPROVED", "APPROVED")).toBe(true);
  });
});

describe("schemas de requisito", () => {
  const valid = { title: "Login com e-mail", description: "O usuário entra com e-mail e senha.", type: "FUNCTIONAL" };
  it("aplica prioridade padrão MEDIUM", () => {
    expect(createRequirementSchema.parse(valid).priority).toBe("MEDIUM");
  });
  it("rejeita título e descrição curtos e tipo inválido", () => {
    expect(createRequirementSchema.safeParse({ ...valid, title: "abc" }).success).toBe(false);
    expect(createRequirementSchema.safeParse({ ...valid, description: "curta" }).success).toBe(false);
    expect(createRequirementSchema.safeParse({ ...valid, type: "OUTRO" }).success).toBe(false);
  });
  it("update rejeita objeto vazio", () => {
    expect(updateRequirementSchema.safeParse({}).success).toBe(false);
  });
  it("lista aplica padrões e limita pageSize", () => {
    const r = listRequirementsQuerySchema.parse({});
    expect(r).toMatchObject({ page: 1, pageSize: 10, sortBy: "createdAt", order: "desc" });
    expect(listRequirementsQuerySchema.safeParse({ pageSize: "999" }).success).toBe(false);
  });
});
