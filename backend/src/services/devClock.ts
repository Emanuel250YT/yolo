import { AsyncLocalStorage } from "node:async_hooks";
import { isDevToolsEnabled } from "../config/devTools.js";

const devClockStorage = new AsyncLocalStorage<Date>();

export interface GlobalDevClockState {
  enabled: boolean;
  iso: string | null;
  updatedAt: string | null;
}

let globalDevClock: { enabled: boolean; at: Date | null; updatedAt: number } = {
  enabled: false,
  at: null,
  updatedAt: 0,
};

export function parseDevTimeHeader(header: string | undefined): Date | null {
  if (!header?.trim()) return null;
  const parsed = new Date(header.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function setGlobalDevClock(enabled: boolean, iso?: string | null) {
  if (!enabled || !iso) {
    globalDevClock = { enabled: false, at: null, updatedAt: Date.now() };
    return;
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return;
  globalDevClock = { enabled: true, at: parsed, updatedAt: Date.now() };
}

export function getGlobalDevClockState(): GlobalDevClockState {
  return {
    enabled: globalDevClock.enabled,
    iso: globalDevClock.at?.toISOString() ?? null,
    updatedAt:
      globalDevClock.updatedAt > 0
        ? new Date(globalDevClock.updatedAt).toISOString()
        : null,
  };
}

/** Hora efectiva (simulada por request, reloj global DevTools o real). */
export function getNow(): Date {
  if (!isDevToolsEnabled()) return new Date();
  const requestSim = devClockStorage.getStore();
  if (requestSim) return new Date(requestSim.getTime());
  if (globalDevClock.enabled && globalDevClock.at) {
    return new Date(globalDevClock.at.getTime());
  }
  return new Date();
}

export function getNowMs(): number {
  return getNow().getTime();
}

export function runWithDevClock<T>(simulated: Date, fn: () => T): T {
  return devClockStorage.run(simulated, fn);
}

export function isSimulatedClockActive(): boolean {
  if (!isDevToolsEnabled()) return false;
  if (devClockStorage.getStore() != null) return true;
  return globalDevClock.enabled && globalDevClock.at != null;
}
