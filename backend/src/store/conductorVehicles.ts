import type { VehicleType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

function mapVehicle(v: {
  id: string;
  userId: string;
  plate: string;
  vehicleType: VehicleType;
  label: string | null;
  source: string;
  createdAt: Date;
}) {
  return {
    ...v,
    createdAt: v.createdAt.toISOString(),
  };
}

async function ensureProfilePlate(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { citizen: true },
  });
  const plate = user?.citizen?.plate?.trim().toUpperCase();
  if (!plate) return;

  await prisma.conductorVehicle.upsert({
    where: { userId_plate: { userId, plate } },
    create: {
      userId,
      plate,
      vehicleType: "auto",
      label: "Patente del registro",
      source: "manual",
    },
    update: {},
  });
}

export async function listConductorPlates(userId: string): Promise<string[]> {
  await ensureProfilePlate(userId);
  const vehicles = await prisma.conductorVehicle.findMany({
    where: { userId },
    select: { plate: true },
  });
  return vehicles.map((v) => v.plate);
}

export async function listConductorVehicles(userId: string) {
  await ensureProfilePlate(userId);
  const vehicles = await prisma.conductorVehicle.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return vehicles.map(mapVehicle);
}

export async function addConductorVehicle(
  userId: string,
  input: {
    plate: string;
    vehicleType?: string;
    label?: string;
  },
) {
  const plate = input.plate?.trim().toUpperCase();
  if (!plate) throw new Error("La patente es obligatoria.");

  const vehicle = await prisma.conductorVehicle.create({
    data: {
      userId,
      plate,
      vehicleType:
        input.vehicleType === "motorcycle" ? "motorcycle" : "auto",
      label: input.label?.trim() || null,
      source: "manual",
    },
  });
  return mapVehicle(vehicle);
}

export async function deleteConductorVehicle(userId: string, id: string) {
  const existing = await prisma.conductorVehicle.findFirst({
    where: { id, userId },
  });
  if (!existing) return false;
  await prisma.conductorVehicle.delete({ where: { id } });
  return true;
}

export async function listParkingAlerts(userId: string) {
  const plates = await listConductorPlates(userId);
  if (!plates.length) return [];

  const now = new Date();
  const permits = await prisma.permit.findMany({
    where: {
      plate: { in: plates },
      status: "active",
      endAt: { gt: now },
    },
    orderBy: { endAt: "asc" },
  });

  return permits.map((p) => {
    const endAt = p.endAt!;
    const minutesRemaining = Math.max(
      0,
      Math.round((endAt.getTime() - now.getTime()) / 60_000),
    );
    return {
      permitId: p.id,
      plate: p.plate,
      zone: p.zone,
      endAt: endAt.toISOString(),
      minutesRemaining,
      durationMinutes: p.durationMinutes,
      pricing: p.pricing,
    };
  });
}
