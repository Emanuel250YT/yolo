import { SHIFTS } from "../config/tariffs.js";
import { isDevToolsEnabled } from "../config/devTools.js";
import { getShiftStatus } from "./shifts.js";

export { isDevToolsEnabled };

export function getShiftStatusWithDevOverride(
  override: string | undefined,
  date = new Date(),
) {
  const base = getShiftStatus(date);
  if (!isDevToolsEnabled() || !override || override === "auto") {
    return base;
  }

  const nightZones = SHIFTS.night.zones;

  if (override === "open") {
    return {
      ...base,
      canCharge: true,
      canChargeDay: true,
      canChargeNight: true,
      activeShift: "day",
      message: "[DEV] Cobro forzado — turno abierto.",
      zones: nightZones,
    };
  }

  if (override === "closed") {
    return {
      ...base,
      canCharge: false,
      canChargeDay: false,
      canChargeNight: false,
      activeShift: null,
      message: "[DEV] Cobro forzado — fuera de horario.",
      zones: [],
    };
  }

  if (override === "day") {
    return {
      ...base,
      canCharge: true,
      canChargeDay: true,
      canChargeNight: false,
      activeShift: "day",
      message: "[DEV] Turno diurno simulado.",
      zones: [],
    };
  }

  if (override === "night") {
    return {
      ...base,
      canCharge: true,
      canChargeDay: false,
      canChargeNight: true,
      activeShift: "night",
      message: "[DEV] Turno nocturno simulado.",
      zones: nightZones,
    };
  }

  return base;
}
