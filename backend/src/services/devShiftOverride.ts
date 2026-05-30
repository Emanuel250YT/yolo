import { SHIFTS } from "../config/tariffs.js";
import { isDevToolsEnabled } from "../config/devTools.js";
import { getNow, isSimulatedClockActive } from "./devClock.js";
import { getShiftStatus } from "./shifts.js";

export { isDevToolsEnabled };

function withDevMeta<T extends { now: string; message: string }>(payload: T) {
  if (!isSimulatedClockActive()) return payload;
  return {
    ...payload,
    simulatedClock: true,
    message: `[DEV ${payload.now.slice(11, 16)}] ${payload.message}`,
  };
}

export function getShiftStatusWithDevOverride(override: string | undefined) {
  const date = getNow();
  const base = withDevMeta(getShiftStatus(date));
  if (!isDevToolsEnabled() || !override || override === "auto") {
    return base;
  }

  const nightZones = SHIFTS.night.zones;

  if (override === "open") {
    return withDevMeta({
      ...base,
      canCharge: true,
      canChargeDay: true,
      canChargeNight: true,
      activeShift: "day",
      message: "[DEV] Cobro forzado — turno abierto.",
      zones: nightZones,
      now: base.now,
    });
  }

  if (override === "closed") {
    return withDevMeta({
      ...base,
      canCharge: false,
      canChargeDay: false,
      canChargeNight: false,
      activeShift: null,
      message: "[DEV] Cobro forzado — fuera de horario.",
      zones: [],
      now: base.now,
    });
  }

  if (override === "day") {
    return withDevMeta({
      ...base,
      canCharge: true,
      canChargeDay: true,
      canChargeNight: false,
      activeShift: "day",
      message: "[DEV] Turno diurno simulado.",
      zones: [],
      now: base.now,
    });
  }

  if (override === "night") {
    return withDevMeta({
      ...base,
      canCharge: true,
      canChargeDay: false,
      canChargeNight: true,
      activeShift: "night",
      message: "[DEV] Turno nocturno simulado.",
      zones: nightZones,
      now: base.now,
    });
  }

  return base;
}
