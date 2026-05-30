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
