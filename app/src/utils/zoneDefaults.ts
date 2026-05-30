import type { ParkingZone, User } from "../types";

export function zoneCodeForUser(
  user: Pick<User, "zone" | "parkingZoneId"> | null | undefined,
  zones: ParkingZone[],
): string {
  if (!user) return zones[0]?.code ?? "";
  if (user.zone) return user.zone;
  if (user.parkingZoneId) {
    const z = zones.find((x) => x.id === user.parkingZoneId);
    if (z) return z.code;
  }
  return zones[0]?.code ?? "";
}

export function zoneLabel(code: string, zones: ParkingZone[]) {
  return zones.find((z) => z.code === code)?.name ?? code;
}

/** Códigos de zona asignados al permisionario; `null` si no aplica filtro. */
export function assignedZoneCodesForUser(
  user:
    | Pick<
        User,
        "role" | "zone" | "parkingZoneId" | "assignedZones" | "parkingZoneIds"
      >
    | null
    | undefined,
  zones: ParkingZone[],
): string[] | null {
  if (!user || user.role !== "permisionario") return null;

  if (user.assignedZones?.length) {
    return user.assignedZones.map((z) => z.code);
  }

  if (user.parkingZoneIds?.length) {
    const codes = user.parkingZoneIds
      .map((id) => zones.find((z) => z.id === id)?.code)
      .filter((c): c is string => Boolean(c));
    if (codes.length) return codes;
  }

  const code = zoneCodeForUser(user, zones);
  return code ? [code] : [];
}

export function filterZonesForUser(
  zones: ParkingZone[],
  user: Parameters<typeof assignedZoneCodesForUser>[0],
): ParkingZone[] {
  const codes = assignedZoneCodesForUser(user, zones);
  const enabled = zones.filter((z) => z.enabled);
  if (!codes) return enabled;
  if (!codes.length) return enabled;
  const codeSet = new Set(codes.map((c) => c.toLowerCase()));
  return enabled.filter((z) => codeSet.has(z.code.toLowerCase()));
}

export function zoneOptionsForPermit(
  zones: ParkingZone[],
  assignedCode: string,
  allowAll: boolean,
) {
  const enabled = zones.filter((z) => z.enabled);
  if (allowAll) {
    return enabled.map((z) => ({ value: z.code, label: z.name }));
  }
  const match = enabled.find((z) => z.code === assignedCode);
  if (match) return [{ value: match.code, label: match.name }];
  if (assignedCode) {
    return [{ value: assignedCode, label: assignedCode }];
  }
  return enabled.map((z) => ({ value: z.code, label: z.name }));
}
