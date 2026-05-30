import type { HistoryAction, Prisma } from "../prisma/client.js";
import { prisma } from "../lib/prisma.js";

export interface LogHistoryInput {
  userId: string;
  userName: string;
  action: HistoryAction;
  permitId?: string | null;
  entityType?: string;
  entityId?: string;
  entityRef?: string | null;
  entityLabel?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  observation?: string | null;
}

export async function logHistory(data: LogHistoryInput) {
  return prisma.historyEntry.create({
    data: {
      userId: data.userId,
      userName: data.userName,
      action: data.action,
      permitId: data.permitId ?? undefined,
      entityType: data.entityType ?? undefined,
      entityId: data.entityId ?? undefined,
      entityRef: data.entityRef ?? undefined,
      entityLabel: data.entityLabel ?? undefined,
      before: data.before ?? undefined,
      after: data.after ?? undefined,
      observation: data.observation?.trim() || null,
    },
  });
}

export async function addHistoryEntry(data: {
  permitId: string;
  userId: string;
  userName: string;
  action: HistoryAction;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  observation?: string | null;
  entityRef?: string | null;
  entityLabel?: string;
}) {
  return logHistory({
    ...data,
    entityType: "permit",
    entityId: data.permitId,
    entityRef: data.entityRef,
    entityLabel: data.entityLabel,
  });
}

export async function listHistory(opts: {
  permitId?: string;
  userId?: string;
  entityType?: string;
  limit?: number;
} = {}) {
  const entries = await prisma.historyEntry.findMany({
    where: {
      ...(opts.permitId ? { permitId: opts.permitId } : {}),
      ...(opts.userId ? { userId: opts.userId } : {}),
      ...(opts.entityType ? { entityType: opts.entityType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 200,
  });

  return entries.map((e) => ({
    id: e.id,
    permitId: e.permitId,
    entityType: e.entityType,
    entityId: e.entityId,
    entityRef: e.entityRef,
    entityLabel: e.entityLabel,
    userId: e.userId,
    userName: e.userName,
    action: e.action,
    before: e.before,
    after: e.after,
    observation: e.observation,
    createdAt: e.createdAt.toISOString(),
  }));
}
