import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler } from "../errors";
import { findOwnedProject } from "../lib/ownership";
import { requireAuth } from "../middlewares/auth";
import {
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from "../schemas/project";

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

const withIndicators = {
  _count: {
    select: {
      requirements: { where: { deletedAt: null } },
      testCases: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.ProjectInclude;

projectsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q, status, page, pageSize } = listProjectsQuerySchema.parse(req.query);
    const where: Prisma.ProjectWhereInput = {
      userId: req.userId!,
      ...(status && { status }),
      ...(q && { name: { contains: q, mode: "insensitive" } }),
    };
    const [total, data] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        include: withIndicators,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ data, total, page, pageSize });
  }),
);

projectsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = createProjectSchema.parse(req.body);
    const project = await prisma.project.create({ data: { ...body, userId: req.userId! } });
    res.status(201).json(project);
  }),
);

projectsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await findOwnedProject(req.params.id, req.userId!);
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: withIndicators,
    });
    res.json(project);
  }),
);

projectsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    await findOwnedProject(req.params.id, req.userId!);
    const body = updateProjectSchema.parse(req.body);
    const project = await prisma.project.update({ where: { id: req.params.id }, data: body });
    res.json(project);
  }),
);

// Arquivar = trocar o status (não apaga dados).
projectsRouter.post(
  "/:id/archive",
  asyncHandler(async (req, res) => {
    await findOwnedProject(req.params.id, req.userId!);
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: { status: "ARCHIVED" },
    });
    res.json(project);
  }),
);
