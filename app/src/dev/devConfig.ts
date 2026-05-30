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

let shiftOverride: DevShiftOverride = "auto";

export function isDevToolsEnabled() {
  return import.meta.env.DEV || import.meta.env.VITE_DEV_TOOLS === "true";
}

export function getDevShiftOverride() {
  return shiftOverride;
}

export function setDevShiftOverride(value: DevShiftOverride) {
  shiftOverride = value;
}

export function getDevHeaders(): Record<string, string> {
  if (!isDevToolsEnabled() || shiftOverride === "auto") return {};
  return { "X-Dev-Shift": shiftOverride };
}

export function parseDevAccounts(): DevAccount[] {
  if (!isDevToolsEnabled()) return [];
  const raw = import.meta.env.VITE_DEV_ACCOUNTS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DevAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const DEFAULT_DEV_GEO: DevGeoOverride = {
  enabled: false,
  lat: -24.7859,
  lng: -65.4117,
};

const STORAGE_KEY = "sem_dev_geo";

export function loadDevGeo(): DevGeoOverride {
  if (!isDevToolsEnabled()) return DEFAULT_DEV_GEO;
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
  if (!isDevToolsEnabled()) return "auto";
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

// Initialize from storage on module load
setDevShiftOverride(loadDevShift());
