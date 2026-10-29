import { prisma } from "../db";
import { AppError } from "../errors";

// Isolamento de dados: só devolve o projeto se ele pertencer ao usuário logado.
// Se não for dele, responde 404 (não revela que o projeto existe).
export async function findOwnedProject(id: string, userId: string) {
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) throw new AppError(404, "Projeto não encontrado");
  return project;
}
