import { z } from "zod";

export const projectStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);

export const createProjectSchema = z.object({
  name: z.string().trim().min(3, "O nome precisa ter ao menos 3 caracteres").max(120),
  description: z.string().trim().max(2000).optional(),
  objective: z.string().trim().max(2000).optional(),
});

export const updateProjectSchema = createProjectSchema
  .partial()
  .extend({ status: projectStatusSchema.optional() })
  .refine((v) => Object.keys(v).length > 0, "Informe ao menos um campo para atualizar");

export const listProjectsQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: projectStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
