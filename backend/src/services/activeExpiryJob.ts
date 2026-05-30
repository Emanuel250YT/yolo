import { isDevToolsEnabled } from "../config/devTools.js";
import { expireAllActiveRecords } from "./expiry.js";

const TICK_MS = 60_000;

let running = false;
let lastResult: Awaited<ReturnType<typeof expireAllActiveRecords>> | null =
  null;

function logResult(result: Awaited<ReturnType<typeof expireAllActiveRecords>>) {
  const total =
    result.permitsEnteredGrace +
    result.permitsAutoCancelled +
    result.holdsExpired +
    result.paymentOrdersExpired +
    result.reservationsExpired +
    result.spotsReconciled;
  if (total === 0) return;
  const sim = result.simulated ? " [sim]" : "";
  console.info(
    `[Expiry${sim}] ${result.at} · tolerancia ${result.permitsEnteredGrace} · cancelados ${result.permitsAutoCancelled} · holds ${result.holdsExpired} · pagos ${result.paymentOrdersExpired} · reservas ${result.reservationsExpired} · plazas ${result.spotsReconciled}`,
  );
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const result = await expireAllActiveRecords();
    lastResult = result;
    logResult(result);
  } catch (err) {
    console.error(
      "[Expiry] Error al caducar registros activos:",
      err instanceof Error ? err.message : err,
    );
  } finally {
    running = false;
  }
}

export function getLastExpiryTick() {
  return lastResult;
}

export function startActiveExpiryJob() {
  void tick();
  setInterval(() => {
    void tick();
  }, TICK_MS);
  const devNote = isDevToolsEnabled()
    ? " · respeta reloj simulado DevTools"
    : "";
  console.info(`[Expiry] Job activo (cada ${TICK_MS / 1000}s${devNote})`);
}
