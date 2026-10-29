export type ProjectStatus = "ACTIVE" | "ARCHIVED";
export type RequirementType = "FUNCTIONAL" | "NON_FUNCTIONAL";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RequirementStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  status: ProjectStatus;
  updatedAt: string;
  _count?: { requirements: number; testCases: number };
}

export interface HistoryEntry {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}

export interface Requirement {
  id: string;
  code: string;
  title: string;
  description: string;
  type: RequirementType;
  priority: Priority;
  status: RequirementStatus;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  history?: HistoryEntry[];
}

export const STATUS_LABEL: Record<RequirementStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em análise",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
};
export const STATUS_STYLE: Record<RequirementStatus, string> = {
  DRAFT: "bg-zinc-700/40 text-zinc-300",
  IN_REVIEW: "bg-amber-500/15 text-amber-300",
  APPROVED: "bg-emerald-500/15 text-emerald-300",
  REJECTED: "bg-red-500/15 text-red-300",
};
export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};
export const PRIORITY_STYLE: Record<Priority, string> = {
  LOW: "bg-zinc-700/40 text-zinc-300",
  MEDIUM: "bg-sky-500/15 text-sky-300",
  HIGH: "bg-orange-500/15 text-orange-300",
  CRITICAL: "bg-red-500/15 text-red-300",
};
export const TYPE_LABEL: Record<RequirementType, string> = {
  FUNCTIONAL: "Funcional",
  NON_FUNCTIONAL: "Não funcional",
};
export const FIELD_LABEL: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  type: "Tipo",
  priority: "Prioridade",
  status: "Status",
  source: "Origem",
};

// Mesmas transições da API (a API continua sendo a autoridade).
export const TRANSITIONS: Record<RequirementStatus, RequirementStatus[]> = {
  DRAFT: ["IN_REVIEW", "REJECTED"],
  IN_REVIEW: ["DRAFT", "APPROVED", "REJECTED"],
  APPROVED: ["IN_REVIEW"],
  REJECTED: ["DRAFT", "IN_REVIEW"],
};

export const formatDate = (iso: string) => new Date(iso).toLocaleString("pt-BR");
