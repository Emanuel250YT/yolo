export type DevShiftOverride = "auto" | "open" | "closed" | "day" | "night";

export interface DevAccount {
  label: string;
  email: string;
  password: string;
}

export interface DevGeoOverride {
  enabled: boolean;
  lat: number;
  lng: number;
}

export interface DevClockOverride {
  enabled: boolean;
  iso: string;
}

export interface AppMeta {
  version: string;
  commit: string;
}

let shiftOverride: DevShiftOverride = "auto";
let clockOverride: DevClockOverride = { enabled: false, iso: "" };

/** Flag local: requiere VITE_DEV_TOOLS=true en app/.env */
export function isClientDevToolsEnabled() {
  return import.meta.env.VITE_DEV_TOOLS === "true";
}

export function isDevToolsEnabled() {
  return isClientDevToolsEnabled();
}

export function getDevShiftOverride() {
  return shiftOverride;
}

export function setDevShiftOverride(value: DevShiftOverride) {
  shiftOverride = value;
}

export function getDevClockOverride() {
  return clockOverride;
}

export function setDevClockOverride(value: DevClockOverride) {
  clockOverride = value;
}

/** Hora efectiva en el cliente (simulada en DevTools o real). */
export function getDevNow(): Date {
  if (
    !isClientDevToolsEnabled() ||
    !clockOverride.enabled ||
    !clockOverride.iso
  ) {
    return new Date();
  }
  const parsed = new Date(clockOverride.iso);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function getDevNowMs(): number {
  return getDevNow().getTime();
}

export function formatDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDatetimeLocal(value: string): string {
  return new Date(value).toISOString();
}

export function formatDevClockDisplay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function bumpDevClockMinutes(minutes: number): DevClockOverride {
  const base = clockOverride.enabled ? getDevNow() : new Date();
  return {
    enabled: true,
    iso: new Date(base.getTime() + minutes * 60_000).toISOString(),
  };
}

export function getDevHeaders(): Record<string, string> {
  if (!isClientDevToolsEnabled()) return {};
  const headers: Record<string, string> = {};
  if (shiftOverride !== "auto") headers["X-Dev-Shift"] = shiftOverride;
  if (clockOverride.enabled && clockOverride.iso) {
    headers["X-Dev-Time"] = clockOverride.iso;
  }
  return headers;
}

const DEFAULT_DEV_ACCOUNTS: DevAccount[] = [
  {
    label: "Municipio",
    email: "municipio@ejemplo.com",
    password: "tu-clave",
  },
  { label: "Admin", email: "admin@ejemplo.com", password: "tu-clave" },
  {
    label: "Permisionario",
    email: "perm@ejemplo.com",
    password: "tu-clave",
  },
  {
    label: "Conductor",
    email: "conductor@ejemplo.com",
    password: "tu-clave",
  },
];

export function parseDevAccounts(): DevAccount[] {
  const raw = import.meta.env.VITE_DEV_ACCOUNTS;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DevAccount[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      /* usar defaults */
    }
  }
  return DEFAULT_DEV_ACCOUNTS;
}

export const DEFAULT_DEV_GEO: DevGeoOverride = {
  enabled: false,
  lat: -24.7859,
  lng: -65.4117,
};

const STORAGE_KEY = "sem_dev_geo";

export function loadDevGeo(): DevGeoOverride {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DEV_GEO;
    const parsed = JSON.parse(raw) as DevGeoOverride;
    return {
      enabled: Boolean(parsed.enabled),
      lat: Number(parsed.lat) || DEFAULT_DEV_GEO.lat,
      lng: Number(parsed.lng) || DEFAULT_DEV_GEO.lng,
    };
  } catch {
    return DEFAULT_DEV_GEO;
  }
}

export function saveDevGeo(geo: DevGeoOverride) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(geo));
}

const SHIFT_STORAGE_KEY = "sem_dev_shift";

export function loadDevShift(): DevShiftOverride {
  const stored = localStorage.getItem(SHIFT_STORAGE_KEY);
  if (
    stored === "open" ||
    stored === "closed" ||
    stored === "day" ||
    stored === "night" ||
    stored === "auto"
  ) {
    return stored;
  }
  return "auto";
}

export function persistDevShift(value: DevShiftOverride) {
  localStorage.setItem(SHIFT_STORAGE_KEY, value);
  setDevShiftOverride(value);
}

const CLOCK_STORAGE_KEY = "sem_dev_clock";

export function loadDevClock(): DevClockOverride {
  try {
    const raw = localStorage.getItem(CLOCK_STORAGE_KEY);
    if (!raw) {
      return { enabled: false, iso: new Date().toISOString() };
    }
    const parsed = JSON.parse(raw) as DevClockOverride;
    return {
      enabled: Boolean(parsed.enabled),
      iso:
        typeof parsed.iso === "string"
          ? parsed.iso
          : new Date().toISOString(),
    };
  } catch {
    return { enabled: false, iso: new Date().toISOString() };
  }
}

export function persistDevClock(value: DevClockOverride) {
  localStorage.setItem(CLOCK_STORAGE_KEY, JSON.stringify(value));
  setDevClockOverride(value);
}

setDevShiftOverride(loadDevShift());
clockOverride = loadDevClock();
