import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16, "JWT_SECRET precisa ter ao menos 16 caracteres"),
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  QA_ALLOWED_HOSTS: z.string().default(""),
});

export const config = envSchema.parse(process.env);
export const qaAllowedHosts = new Set(
  config.QA_ALLOWED_HOSTS.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
);
