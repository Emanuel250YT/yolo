import { prisma } from "../lib/prisma.js";

export function normalizeZoneCode(code: string) {
  return code
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function resolveParkingZoneAssignment(input: {
  parkingZoneId?: string | null;
  zone?: string | null;
  required?: boolean;
}) {
  if (input.parkingZoneId) {
    const z = await prisma.parkingZone.findUnique({
      where: { id: input.parkingZoneId },
    });
    if (!z) throw new Error("Zona de parking no encontrada.");
    if (!z.enabled) throw new Error("La zona seleccionada no está habilitada.");
    return { parkingZoneId: z.id, zone: z.code, zoneName: z.name };
  }

  if (input.zone?.trim()) {
    const code = normalizeZoneCode(input.zone);
    const z = await prisma.parkingZone.findUnique({ where: { code } });
    if (z) {
      if (!z.enabled) throw new Error("La zona seleccionada no está habilitada.");
      return { parkingZoneId: z.id, zone: z.code, zoneName: z.name };
    }
    if (input.required) {
      throw new Error(
        "Indicá una zona válida del catálogo (creala en Administración → Zonas).",
      );
    }
    return { parkingZoneId: null as string | null, zone: code, zoneName: code };
  }

  if (input.required) {
    throw new Error("La zona asignada es obligatoria para permisionarios.");
  }

  return {
    parkingZoneId: null as string | null,
    zone: null as string | null,
    zoneName: null as string | null,
  };
}
