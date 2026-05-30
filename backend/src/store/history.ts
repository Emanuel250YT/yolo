import type { HistoryAction, Prisma } from "../prisma/client.js";
import {
  paginatedResult,
  type PaginatedResult,
  type PaginationParams,
} from "../lib/pagination.js";
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

function mapHistoryEntry(e: {
  id: string;
  permitId: string | null;
  entityType: string | null;
  entityId: string | null;
  entityRef: string | null;
  entityLabel: string | null;
  userId: string;
  userName: string;
  action: HistoryAction;
  before: unknown;
  after: unknown;
  observation: string | null;
  createdAt: Date;
}) {
  return {
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
  };
}

export async function listHistory(opts: {
  permitId?: string;
  userId?: string;
  entityType?: string;
  action?: string;
  limit?: number;
  pagination?: PaginationParams;
} = {}) {
  const search = opts.pagination?.q
    ? {
        OR: [
          { userName: { contains: opts.pagination.q, mode: "insensitive" as const } },
          { entityRef: { contains: opts.pagination.q, mode: "insensitive" as const } },
          { entityLabel: { contains: opts.pagination.q, mode: "insensitive" as const } },
          { observation: { contains: opts.pagination.q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const where: Prisma.HistoryEntryWhereInput = {
    ...(opts.permitId ? { permitId: opts.permitId } : {}),
    ...(opts.userId ? { userId: opts.userId } : {}),
    ...(opts.entityType ? { entityType: opts.entityType } : {}),
    ...(opts.action ? { action: opts.action as HistoryAction } : {}),
    ...search,
  };

  if (opts.pagination) {
    const [total, entries] = await Promise.all([
      prisma.historyEntry.count({ where }),
      prisma.historyEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: opts.pagination.skip,
        take: opts.pagination.take,
      }),
    ]);
    return paginatedResult(entries.map(mapHistoryEntry), total, opts.pagination);
  }

  const entries = await prisma.historyEntry.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 200,
  });

  return entries.map(mapHistoryEntry);
}
