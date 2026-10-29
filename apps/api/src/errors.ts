import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Express 4 não captura erros de funções async sozinho; este wrapper resolve.
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Dados inválidos",
      details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message });
  }
  // Não vaza detalhes internos nem dados sensíveis para o cliente.
  console.error("Erro inesperado:", err instanceof Error ? err.message : "desconhecido");
  return res.status(500).json({ error: "Erro interno do servidor" });
};
