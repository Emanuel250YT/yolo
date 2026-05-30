import { getNow } from "../services/devClock.js";
import { prisma } from "../lib/prisma.js";
import { generateUniqueRef } from "../lib/shortRef.js";
import { calculateAmount } from "../services/pricing.js";

function mapSession(s: {
  id: string;
  ref: string | null;
  plate: string;
  vehicleType: string;
  zone: string;
  digitalPayment: boolean;
  permitId: string | null;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  checkout: unknown;
}) {
  return {
    id: s.id,
    ref: s.ref,
    plate: s.plate,
    vehicleType: s.vehicleType,
    zone: s.zone,
    digitalPayment: s.digitalPayment,
    permitId: s.permitId,
    status: s.status,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
    checkout: s.checkout,
  };
}

export async function createSession(input: {
  plate: string;
  vehicleType?: string;
  zone?: string;
  digitalPayment?: boolean;
  permitId?: string | null;
  createdById?: string;
}) {
  if (!input.plate?.trim()) {
    throw new Error("La patente es obligatoria.");
  }

  const session = await prisma.parkingSession.create({
    data: {
      ref: await generateUniqueRef("parkingSession"),
      plate: input.plate.trim().toUpperCase(),
      vehicleType:
        input.vehicleType === "motorcycle" ? "motorcycle" : "auto",
      zone: input.zone ?? "microcentro",
      digitalPayment: Boolean(input.digitalPayment),
      permitId: input.permitId ?? null,
      createdById: input.createdById ?? null,
    },
  });

  return mapSession(session);
}

export async function listSessions(opts: { status?: string } = {}) {
  const sessions = await prisma.parkingSession.findMany({
    where: opts.status
      ? { status: opts.status as "active" | "completed" }
      : undefined,
    orderBy: { startedAt: "desc" },
  });
  return sessions.map(mapSession);
}

export async function getSession(id: string) {
  const s = await prisma.parkingSession.findUnique({ where: { id } });
  return s ? mapSession(s) : null;
}

export async function checkoutSession(
  id: string,
  opts: { digitalPayment?: boolean } = {},
) {
  const session = await prisma.parkingSession.findUnique({ where: { id } });
  if (!session) return null;
  if (session.status !== "active") {
    throw new Error("La sesión ya fue finalizada.");
  }

  const endedAt = getNow();
  const minutes = Math.max(
    0,
    Math.round((endedAt.getTime() - session.startedAt.getTime()) / 60000),
  );

  const useDigital =
    opts.digitalPayment !== undefined
      ? opts.digitalPayment
      : session.digitalPayment;

  const pricing = calculateAmount({
    vehicleType: session.vehicleType,
    minutes,
    digitalPayment: useDigital,
  });

  const checkout = { minutes, ...pricing };

  const updated = await prisma.parkingSession.update({
    where: { id },
    data: {
      status: "completed",
      endedAt,
      digitalPayment: useDigital,
      checkout,
    },
  });

  return mapSession(updated);
}
