import { prisma } from "../lib/prisma.js";
import { refreshUserMercadoPagoToken } from "../store/mercadopago.js";

const JOB_INTERVAL_MS = 5 * 60 * 1000;
const REFRESH_BEFORE_MS = 30 * 60 * 1000;

let running = false;

export async function refreshExpiringMercadoPagoTokens() {
  if (running) return;
  running = true;

  try {
    const threshold = new Date(Date.now() + REFRESH_BEFORE_MS);
    const users = await prisma.user.findMany({
      where: {
        role: "permisionario",
        mercadoPagoRefreshToken: { not: null },
        OR: [
          { mercadoPagoTokenExpiresAt: { lte: threshold } },
          { mercadoPagoTokenExpiresAt: null },
        ],
      },
      select: { id: true, email: true },
    });

    if (users.length === 0) return;

    console.info(`[MP Refresh] Renovando ${users.length} token(s)…`);

    for (const user of users) {
      try {
        await refreshUserMercadoPagoToken(user.id);
        console.info(`[MP Refresh] OK ${user.email}`);
      } catch (err) {
        console.error(
          `[MP Refresh] Error ${user.email}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  } finally {
    running = false;
  }
}

export function startMercadoPagoTokenRefreshJob() {
  void refreshExpiringMercadoPagoTokens();
  setInterval(() => {
    void refreshExpiringMercadoPagoTokens();
  }, JOB_INTERVAL_MS);
  console.info(
    `[MP Refresh] Job activo (cada ${JOB_INTERVAL_MS / 60000} min)`,
  );
}
