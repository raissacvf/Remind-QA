import { z } from "zod";

export const requirementTypeSchema = z.enum(["FUNCTIONAL", "NON_FUNCTIONAL"]);
export const prioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const requirementStatusSchema = z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED"]);

export const createRequirementSchema = z.object({
  title: z.string().trim().min(5, "O título precisa ter ao menos 5 caracteres").max(200),
  description: z.string().trim().min(10, "A descrição precisa ter ao menos 10 caracteres").max(5000),
  type: requirementTypeSchema,
  priority: prioritySchema.default("MEDIUM"),
  source: z.string().trim().max(200).nullable().optional(),
});

// Na criação o status é sempre RASCUNHO; ele só muda pela edição, respeitando as transições.
export const updateRequirementSchema = z
  .object({
    title: createRequirementSchema.shape.title,
    description: createRequirementSchema.shape.description,
    type: requirementTypeSchema,
    priority: prioritySchema,
    status: requirementStatusSchema,
    source: z.string().trim().max(200).nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Informe ao menos um campo para atualizar");

export const listRequirementsQuerySchema = z.object({
  q: z.string().trim().optional(),
  status: requirementStatusSchema.optional(),
  priority: prioritySchema.optional(),
  type: requirementTypeSchema.optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title", "priority", "status"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
