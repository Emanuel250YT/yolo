import { AsyncLocalStorage } from "node:async_hooks";
import { isDevToolsEnabled } from "../config/devTools.js";

const devClockStorage = new AsyncLocalStorage<Date>();

export function parseDevTimeHeader(header: string | undefined): Date | null {
  if (!header?.trim()) return null;
  const parsed = new Date(header.trim());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Hora efectiva para la request actual (simulada en DevTools o real). */
export function getNow(): Date {
  if (!isDevToolsEnabled()) return new Date();
  const simulated = devClockStorage.getStore();
  if (simulated) return new Date(simulated.getTime());
  return new Date();
}

export function getNowMs(): number {
  return getNow().getTime();
}

export function runWithDevClock<T>(simulated: Date, fn: () => T): T {
  return devClockStorage.run(simulated, fn);
}

export function isSimulatedClockActive(): boolean {
  return isDevToolsEnabled() && devClockStorage.getStore() != null;
}
