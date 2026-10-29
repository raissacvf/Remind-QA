import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { AppError, asyncHandler } from "../errors";
import { requireAuth } from "../middlewares/auth";
import { findOwnedProject } from "../lib/ownership";
import { canTransition, formatCode } from "../domain/requirement";
import {
  createRequirementSchema,
  listRequirementsQuerySchema,
  updateRequirementSchema,
} from "../schemas/requirement";

// Montado em /api/projects/:projectId/requirements
export const requirementsRouter = Router({ mergeParams: true });
requirementsRouter.use(requireAuth);

const TRACKED_FIELDS = ["title", "description", "type", "priority", "status", "source"] as const;

// Busca um requisito (não excluído) garantindo que o projeto é do usuário.
async function findRequirement(projectId: string, id: string, userId: string) {
  await findOwnedProject(projectId, userId);
  const requirement = await prisma.requirement.findFirst({
    where: { id, projectId, deletedAt: null },
  });
  if (!requirement) throw new AppError(404, "Requisito não encontrado");
  return requirement;
}

requirementsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    await findOwnedProject(projectId, req.userId!);
    const { q, status, priority, type, sortBy, order, page, pageSize } =
      listRequirementsQuerySchema.parse(req.query);

    const where: Prisma.RequirementWhereInput = {
      projectId,
      deletedAt: null,
      ...(status && { status }),
      ...(priority && { priority }),
      ...(type && { type }),
      ...(q && {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
        ],
      }),
    };
    const [total, data] = await Promise.all([
      prisma.requirement.count({ where }),
      prisma.requirement.findMany({
        where,
        orderBy: { [sortBy]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ data, total, page, pageSize });
  }),
);

requirementsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const projectId = req.params.projectId;
    const project = await findOwnedProject(projectId, req.userId!);
    if (project.status === "ARCHIVED") {
      throw new AppError(409, "Projeto arquivado: não é possível criar requisitos");
    }
    const body = createRequirementSchema.parse(req.body);

    // Contador e criação na mesma transação: evita códigos repetidos (REQ-001 duas vezes).
    const requirement = await prisma.$transaction(async (tx) => {
      const { reqCounter } = await tx.project.update({
        where: { id: projectId },
        data: { reqCounter: { increment: 1 } },
        select: { reqCounter: true },
      });
      const code = formatCode("REQ", reqCounter);
      return tx.requirement.create({
        data: {
          ...body,
          projectId,
          code,
          history: { create: { field: "criação", newValue: code } },
        },
      });
    });
    res.status(201).json(requirement);
  }),
);

requirementsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const base = await findRequirement(req.params.projectId, req.params.id, req.userId!);
    const requirement = await prisma.requirement.findUnique({
      where: { id: base.id },
      include: {
        history: { orderBy: { changedAt: "desc" } },
        _count: { select: { criteria: true, testCases: true } },
      },
    });
    res.json(requirement);
  }),
);

requirementsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const current = await findRequirement(req.params.projectId, req.params.id, req.userId!);
    const body = updateRequirementSchema.parse(req.body);

    if (body.status && !canTransition(current.status, body.status)) {
      throw new AppError(409, `Transição de status não permitida: ${current.status} → ${body.status}`);
    }

    // Só registra no histórico o que realmente mudou.
    const changes = TRACKED_FIELDS.filter(
      (f) => body[f] !== undefined && body[f] !== current[f],
    ).map((f) => ({
      requirementId: current.id,
      field: f,
      oldValue: current[f] == null ? null : String(current[f]),
      newValue: body[f] == null ? null : String(body[f]),
    }));
    if (changes.length === 0) return res.json(current);

    const [updated] = await prisma.$transaction([
      prisma.requirement.update({ where: { id: current.id }, data: body }),
      prisma.requirementHistory.createMany({ data: changes }),
    ]);
    res.json(updated);
  }),
);

// Exclusão lógica: o requisito some das listas, mas histórico, critérios e testes são preservados.
requirementsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const current = await findRequirement(req.params.projectId, req.params.id, req.userId!);
    await prisma.$transaction([
      prisma.requirement.update({ where: { id: current.id }, data: { deletedAt: new Date() } }),
      prisma.requirementHistory.create({
        data: { requirementId: current.id, field: "exclusão", oldValue: current.code },
      }),
    ]);
    res.status(204).end();
  }),
);
