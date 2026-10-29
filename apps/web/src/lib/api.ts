export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

type Options = { method?: string; body?: unknown };

export async function api<T>(path: string, { method = "GET", body }: Options = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "Erro inesperado", data?.details);
  return data as T;
}

export const errMsg = (e: unknown) =>
  e instanceof TypeError
    ? "Não foi possível conectar à API. Ela está rodando?"
    : e instanceof Error
      ? e.message
      : "Erro inesperado";

// Transforma os erros de validação da API em { campo: mensagem }.
export function fieldErrors(e: unknown): Record<string, string> {
  if (e instanceof ApiError && e.details) {
    return Object.fromEntries(e.details.map((d) => [d.field, d.message]));
  }
  return {};
}
