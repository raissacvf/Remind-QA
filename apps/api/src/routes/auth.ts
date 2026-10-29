import { Router } from "express";
import type { Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../db";
import { config } from "../config";
import { AppError, asyncHandler } from "../errors";
import { COOKIE_NAME, requireAuth } from "../middlewares/auth";
import { credentialsSchema } from "../schemas/auth";

export const authRouter = Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.NODE_ENV === "production",
  maxAge: 1000 * 60 * 60 * 8, // 8 horas
};

function startSession(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: "8h" });
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw new AppError(409, "E-mail já cadastrado");
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash } });
    startSession(res, user.id);
    res.status(201).json({ id: user.id, email: user.email });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { email, password } = credentialsSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem).
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!user || !ok) throw new AppError(401, "E-mail ou senha incorretos");
    startSession(res, user.id);
    res.json({ id: user.id, email: user.email });
  }),
);

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.clearCookie("reqmind_token");
  res.status(204).end();
});

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true },
    });
    if (!user) throw new AppError(401, "Usuário não encontrado");
    res.json(user);
  }),
);
