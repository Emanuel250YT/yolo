import type { PermitStatus, UserRole, VehicleType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AuthActor } from "../types/api.js";
import { addHistoryEntry } from "./history.js";
import { findById } from "./users.js";

function mapPermit(p: {
  id: string;
  permisionarioId: string;
  permisionarioName: string;
  permisionarioLegajo: string | null;
  plate: string;
  zone: string;
  vehicleType: VehicleType;
  notes: string | null;
  status: PermitStatus;
  startAt: Date;
  endAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...p,
    startAt: p.startAt.toISOString(),
    endAt: p.endAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export async function listPermits(opts: {
  permisionarioId?: string;
  status?: PermitStatus;
} = {}) {
  const permits = await prisma.permit.findMany({
    where: {
      ...(opts.permisionarioId
        ? { permisionarioId: opts.permisionarioId }
        : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return permits.map(mapPermit);
}

export async function getPermit(id: string) {
  const p = await prisma.permit.findUnique({ where: { id } });
  return p ? mapPermit(p) : null;
}

export async function createPermit(
  input: {
    plate: string;
    zone?: string;
    vehicleType?: string;
    notes?: string;
    startAt?: string;
    endAt?: string | null;
    permisionarioId?: string;
  },
  actor: AuthActor,
) {
  if (!input.plate?.trim()) throw new Error("La patente es obligatoria.");

  let permisionario = actor;
  if (actor.role === "admin") {
    if (!input.permisionarioId) {
      throw new Error("Indicá un permisionario válido (permisionarioId).");
    }
    const target = await findById(input.permisionarioId);
    if (!target || target.role !== "permisionario") {
      throw new Error("Indicá un permisionario válido (permisionarioId).");
    }
    permisionario = {
      id: target.id,
      name: target.name,
      role: target.role,
      legajo: target.legajo,
      zone: target.zone,
    };
  } else if (actor.role !== "permisionario") {
    throw new Error("Sin permisos para crear permisos de estacionamiento.");
  }

  const permit = await prisma.permit.create({
    data: {
      permisionarioId: permisionario.id,
      permisionarioName: permisionario.name,
      permisionarioLegajo: permisionario.legajo ?? null,
      plate: input.plate.trim().toUpperCase(),
      zone: input.zone?.trim() || permisionario.zone || "microcentro",
      vehicleType:
        input.vehicleType === "motorcycle" ? "motorcycle" : "auto",
      notes: input.notes?.trim() || null,
      startAt: input.startAt ? new Date(input.startAt) : new Date(),
      endAt: input.endAt ? new Date(input.endAt) : null,
    },
  });

  const mapped = mapPermit(permit);
  await addHistoryEntry({
    permitId: permit.id,
    userId: actor.id,
    userName: actor.name,
    action: "create",
    after: mapped,
  });

  return mapped;
}

export async function updatePermit(
  id: string,
  patch: Record<string, unknown>,
  actor: AuthActor,
) {
  const existing = await prisma.permit.findUnique({ where: { id } });
  if (!existing) return null;

  if (
    actor.role === "permisionario" &&
    existing.permisionarioId !== actor.id
  ) {
    throw new Error("No podés modificar permisos de otro permisionario.");
  }

  const before = mapPermit(existing);
  const data: Record<string, unknown> = {};

  if (patch.plate !== undefined) {
    data.plate = String(patch.plate).trim().toUpperCase();
  }
  if (patch.zone !== undefined) data.zone = patch.zone;
  if (patch.vehicleType !== undefined) {
    data.vehicleType =
      patch.vehicleType === "motorcycle" ? "motorcycle" : "auto";
  }
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.endAt !== undefined) {
    data.endAt = patch.endAt ? new Date(String(patch.endAt)) : null;
  }

  const permit = await prisma.permit.update({
    where: { id },
    data,
  });

  const mapped = mapPermit(permit);
  await addHistoryEntry({
    permitId: id,
    userId: actor.id,
    userName: actor.name,
    action: "update",
    before,
    after: mapped,
    observation:
      typeof patch.observation === "string" ? patch.observation : null,
  });

  return mapped;
}

export async function addObservation(
  id: string,
  observation: string,
  actor: AuthActor,
) {
  const permit = await getPermit(id);
  if (!permit) return null;
  if (
    actor.role === "permisionario" &&
    permit.permisionarioId !== actor.id
  ) {
    throw new Error("No autorizado.");
  }
  if (!observation?.trim()) {
    throw new Error("La observación no puede estar vacía.");
  }

  await addHistoryEntry({
    permitId: id,
    userId: actor.id,
    userName: actor.name,
    action: "observation",
    observation: observation.trim(),
    after: { note: observation.trim() },
  });

  return permit;
}
