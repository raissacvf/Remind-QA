import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "../errors";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export const COOKIE_NAME = "remindqa_token";
const LEGACY_COOKIE_NAME = "reqmind_token";

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME] ?? req.cookies?.[LEGACY_COOKIE_NAME];
  if (!token) return next(new AppError(401, "Não autenticado"));
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    next(new AppError(401, "Sessão inválida ou expirada"));
  }
};
