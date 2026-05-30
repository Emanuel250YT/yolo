/** Ventana de reserva: desde ahora hasta +maxAdvanceMinutes. */

import { getDevNowMs } from "../dev/devConfig";

export function buildReservationStartSlots(maxAdvanceMinutes = 30) {
  const now = getDevNowMs();
  const max = now + maxAdvanceMinutes * 60_000;
  const stepMs = 5 * 60_000;

  const slots: { value: string; label: string }[] = [];

  slots.push({
    value: new Date(now).toISOString(),
    label: `Ahora (${formatClock(now)})`,
  });

  let t = Math.ceil(now / stepMs) * stepMs;
  if (t <= now) t += stepMs;

  while (t <= max) {
    slots.push({
      value: new Date(t).toISOString(),
      label: formatClock(t),
    });
    t += stepMs;
  }

  return slots;
}

function formatClock(ms: number) {
  return new Date(ms).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function defaultStartSlot(maxAdvanceMinutes = 30) {
  return (
    buildReservationStartSlots(maxAdvanceMinutes)[0]?.value ??
    new Date(getDevNowMs()).toISOString()
  );
}

export const RESERVATION_HOUR_OPTIONS = Array.from({ length: 23 }, (_, i) => i + 1);
