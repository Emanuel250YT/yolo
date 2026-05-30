import { prisma } from "../lib/prisma.js";

export async function expireStalePermits(now = new Date()) {
  const expired = await prisma.permit.findMany({
    where: {
      status: "active",
      endAt: { lte: now },
    },
    select: { id: true, ref: true, plate: true, endAt: true },
  });

  if (expired.length === 0) return { count: 0 };

  await prisma.permit.updateMany({
    where: { id: { in: expired.map((p) => p.id) } },
    data: { status: "completed" },
  });

  return { count: expired.length };
}

export async function expireStaleRecords() {
  const permits = await expireStalePermits();
  return { permitsExpired: permits.count };
}
