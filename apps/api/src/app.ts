import express from "express";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth";
import { projectsRouter } from "./routes/projects";
import { requirementsRouter } from "./routes/requirements";
import { qaRouter } from "./routes/qa";
import { errorHandler } from "./errors";

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", authRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/projects/:projectId/requirements", requirementsRouter);
  app.use("/api/projects/:projectId/qa", qaRouter);

  app.use(errorHandler);
  return app;
}
