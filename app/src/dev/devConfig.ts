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

export interface AppMeta {
  version: string;
  commit: string;
}

let shiftOverride: DevShiftOverride = "auto";

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

export function getDevHeaders(): Record<string, string> {
  if (!isClientDevToolsEnabled() || shiftOverride === "auto") return {};
  return { "X-Dev-Shift": shiftOverride };
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

setDevShiftOverride(loadDevShift());
