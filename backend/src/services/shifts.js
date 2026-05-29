import { SHIFTS } from "../config/tariffs.js";

function parseTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function nowMinutes(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function inRange(minutes, start, end) {
  if (start <= end) return minutes >= start && minutes < end;
  return minutes >= start || minutes < end;
}

/**
 * Estado operativo simplificado según día y hora local.
 */
export function getShiftStatus(date = new Date()) {
  const day = date.getDay();
  const minutes = nowMinutes(date);
  const isSaturday = day === 6;
  const isSunday = day === 0;

  const dayShift = SHIFTS.day;
  const nightShift = SHIFTS.night;

  let dayWindow = dayShift.weekday;
  if (isSaturday) dayWindow = dayShift.saturday;
  if (isSunday) {
    const canChargeNight = inRange(
      minutes,
      parseTime(nightShift.daily.start),
      parseTime(nightShift.daily.end),
    );
    return {
      canChargeDay: false,
      canChargeNight,
      canCharge: canChargeNight,
      activeShift: canChargeNight ? "night" : null,
      message: canChargeNight
        ? "Domingo: turno nocturno en zonas habilitadas."
        : "Domingo: sin cobro diurno. Fuera de horario nocturno.",
      zones: canChargeNight ? nightShift.zones : [],
      now: date.toISOString(),
    };
  }

  const dayStart = parseTime(dayWindow.start);
  const dayEnd = parseTime(dayWindow.end);
  const nightStart = parseTime(nightShift.daily.start);
  const nightEnd = parseTime(nightShift.daily.end);

  const canChargeDay = inRange(minutes, dayStart, dayEnd);
  const canChargeNight = inRange(minutes, nightStart, nightEnd);

  let activeShift = null;
  let message = "Fuera de horario de cobro.";
  if (canChargeDay) {
    activeShift = "day";
    message = `Turno diurno activo (${dayWindow.start}–${dayWindow.end}).`;
  } else if (canChargeNight) {
    activeShift = "night";
    message = "Turno nocturno activo en zonas habilitadas.";
  }

  return {
    canChargeDay,
    canChargeNight,
    canCharge: canChargeDay || canChargeNight,
    activeShift,
    message,
    zones: canChargeNight ? nightShift.zones : [],
    now: date.toISOString(),
  };
}
