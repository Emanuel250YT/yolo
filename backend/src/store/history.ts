import type { HistoryAction, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function addHistoryEntry(data: {
  permitId: string;
  userId: string;
  userName: string;
  action: HistoryAction;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  observation?: string | null;
}) {
  return prisma.historyEntry.create({
    data: {
      permitId: data.permitId,
      userId: data.userId,
      userName: data.userName,
      action: data.action,
      before: data.before ?? undefined,
      after: data.after ?? undefined,
      observation: data.observation?.trim() || null,
    },
  });
}

export async function listHistory(opts: {
  permitId?: string;
  userId?: string;
  limit?: number;
} = {}) {
  const entries = await prisma.historyEntry.findMany({
    where: {
      ...(opts.permitId ? { permitId: opts.permitId } : {}),
      ...(opts.userId ? { userId: opts.userId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });

  return entries.map((e) => ({
    id: e.id,
    permitId: e.permitId,
    userId: e.userId,
    userName: e.userName,
    action: e.action,
    before: e.before,
    after: e.after,
    observation: e.observation,
    createdAt: e.createdAt.toISOString(),
  }));
}
