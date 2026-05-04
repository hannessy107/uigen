"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function updateProjectGithubRepo(projectId: string, githubRepo: string | null) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  await prisma.project.update({
    where: { id: projectId, userId: session.userId },
    data: { githubRepo },
  });
}
