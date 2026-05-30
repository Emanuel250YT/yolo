import { listHistory } from "./history.js";
import { listPermits } from "./permits.js";
import { listParkingZones } from "./parkingZones.js";
import { listReservations } from "./reservations.js";
import { listSessions } from "./sessions.js";
import { listSpotsLive } from "./spots.js";
import { listUsers } from "./users.js";

function countBy<T>(items: T[], keyFn: (item: T) => string) {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function pricingNet(pricing: unknown): number {
  if (!pricing || typeof pricing !== "object") return 0;
  const net = (pricing as { net?: number }).net;
  return typeof net === "number" ? net : 0;
}

export async function getDashboardStats() {
  const [users, permits, reservations, sessions, spotsLive, zones, history] =
    await Promise.all([
      listUsers(),
      listPermits(),
      listReservations(),
      listSessions(),
      listSpotsLive(),
      listParkingZones(),
      listHistory({ limit: 500 }),
    ]);

  const today = startOfDay();

  const usersByRole = countBy(users, (u) => u.role);
  const usersPending = users.filter((u) => u.activationPending).length;

  const permitsByStatus = countBy(permits, (p) => p.status);
  const reservationsByStatus = countBy(reservations, (r) => r.status);

  const sessionsActive = sessions.filter((s) => s.status === "active").length;
  const sessionsCompleted = sessions.filter(
    (s) => s.status === "completed",
  ).length;

  const spotsByStatus = {
    available: 0,
    occupied: 0,
    held: 0,
    disabled: 0,
    total: spotsLive.length,
  };
  for (const spot of spotsLive) {
    if (spot.status in spotsByStatus) {
      spotsByStatus[spot.status as keyof typeof spotsByStatus]++;
    }
  }

  let revenuePermitsToday = 0;
  let revenueSessionsToday = 0;
  for (const permit of permits) {
    if (
      permit.paidAt &&
      new Date(permit.paidAt) >= today &&
      permit.pricing
    ) {
      revenuePermitsToday += pricingNet(permit.pricing);
    }
  }
  for (const session of sessions) {
    if (
      session.endedAt &&
      new Date(session.endedAt) >= today &&
      session.checkout
    ) {
      revenueSessionsToday += pricingNet(session.checkout);
    }
  }

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return isoDate(d);
  });

  const revenueLast7Days = last7Days.map((date) => {
    let amount = 0;
    for (const permit of permits) {
      if (permit.paidAt?.startsWith(date) && permit.pricing) {
        amount += pricingNet(permit.pricing);
      }
    }
    for (const session of sessions) {
      if (session.endedAt?.startsWith(date) && session.checkout) {
        amount += pricingNet(session.checkout);
      }
    }
    return { date, amount };
  });

  const permitsLast7Days = last7Days.map((date) => ({
    date,
    count: permits.filter((p) => p.createdAt.startsWith(date)).length,
  }));

  const zoneNames = new Map(zones.map((z) => [z.code, z.name]));
  const zoneAgg = new Map<
    string,
    { total: number; occupied: number; held: number; available: number }
  >();

  for (const spot of spotsLive) {
    const cur = zoneAgg.get(spot.zone) ?? {
      total: 0,
      occupied: 0,
      held: 0,
      available: 0,
    };
    cur.total++;
    if (spot.status === "occupied") cur.occupied++;
    else if (spot.status === "held") cur.held++;
    else if (spot.status === "available") cur.available++;
    zoneAgg.set(spot.zone, cur);
  }

  const zoneOccupancy = [...zoneAgg.entries()]
    .map(([zone, stats]) => ({
      zone,
      zoneName: zoneNames.get(zone) ?? zone,
      ...stats,
      occupancyPct:
        stats.total > 0
          ? Math.round(((stats.occupied + stats.held) / stats.total) * 100)
          : 0,
    }))
    .sort((a, b) => b.occupancyPct - a.occupancyPct);

  const recentPermits = permits.slice(0, 8).map((p) => ({
    id: p.id,
    ref: p.ref,
    plate: p.plate,
    zone: p.zone,
    status: p.status,
    net: p.pricing ? pricingNet(p.pricing) : null,
    createdAt: p.createdAt,
  }));

  const recentReservations = reservations.slice(0, 8).map((r) => ({
    id: r.id,
    ref: r.ref,
    plate: r.plate,
    spotLabel: r.spotLabel,
    status: r.status,
    net: r.pricing ? pricingNet(r.pricing) : null,
    scheduledStart: r.scheduledStart,
  }));

  return {
    overview: {
      users: users.length,
      permits: permits.length,
      spots: spotsLive.length,
      reservations: reservations.length,
      sessions: sessions.length,
      history: history.length,
      parkingZones: zones.length,
    },
    usersByRole,
    usersPending,
    permitsByStatus,
    reservationsByStatus,
    sessionsActive,
    sessionsCompleted,
    spotsByStatus,
    revenueToday: {
      permits: revenuePermitsToday,
      sessions: revenueSessionsToday,
      total: revenuePermitsToday + revenueSessionsToday,
    },
    revenueLast7Days,
    permitsLast7Days,
    zoneOccupancy,
    recentPermits,
    recentReservations,
    generatedAt: new Date().toISOString(),
  };
}
