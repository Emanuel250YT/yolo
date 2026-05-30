import type { ParkingZone, User } from "../types";

export function zoneIdOptions(zones: ParkingZone[]) {
  return zones.map((z) => ({
    value: z.id,
    label: `${z.name} (${z.code})`,
    keywords: `${z.id} ${z.code} ${z.name} ${z.description}`,
  }));
}

export function zoneCodeOptions(
  zones: ParkingZone[],
  items: { value: string; label: string }[],
) {
  return items.map((item) => {
    const z = zones.find((x) => x.code === item.value);
    return {
      value: item.value,
      label: item.label,
      keywords: z
        ? `${z.id} ${z.code} ${z.name} ${z.description}`
        : item.value,
    };
  });
}

export function permisionarioOptions(users: User[]) {
  return users.map((u) => ({
    value: u.id,
    label: `${u.name} · Leg. ${u.legajo ?? "—"} · ${u.zoneName ?? u.zone ?? "sin zona"}`,
    keywords: `${u.id} ${u.name} ${u.legajo ?? ""} ${u.email} ${u.zoneName ?? ""} ${u.zone ?? ""}`,
  }));
}
