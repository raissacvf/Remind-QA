// Regras de negócio puras (sem banco), fáceis de testar.

export type RequirementStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";

// Fluxo permitido: um requisito só é aprovado depois de passar por análise.
const transitions: Record<RequirementStatus, RequirementStatus[]> = {
  DRAFT: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["DRAFT", "APPROVED", "REJECTED"],
  APPROVED: ["IN_REVIEW"],
  REJECTED: ["DRAFT", "IN_REVIEW"],
};

export function canTransition(from: RequirementStatus, to: RequirementStatus): boolean {
  return from === to || transitions[from].includes(to);
}

// REQ-001, REQ-002, ...
export function formatCode(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}
