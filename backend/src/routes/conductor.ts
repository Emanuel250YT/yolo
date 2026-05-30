import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { MAX_RESERVATION_ADVANCE_MS } from "../config/auth.js";
import { SPOT_HOLD_MS } from "../config/reservations.js";
import {
  addConductorVehicle,
  deleteConductorVehicle,
  listConductorVehicles,
  listParkingAlerts,
} from "../store/conductorVehicles.js";
import { syncGovVehicles } from "../store/govVehicleSync.js";
import { listParkingBlocks } from "../store/parkingBlocks.js";
import { getParkingZone } from "../store/parkingZones.js";
import {
  cancelReservation,
  listReservations,
} from "../store/reservations.js";
import {
  cancelSpotHold,
  confirmSpotHold,
  createSpotHold,
  getSpotHold,
} from "../store/spotHolds.js";
import { listSpotsLive } from "../store/spots.js";

const router = Router();

router.get("/spots", async (req, res) => {
  const onlyAvailable = req.query.available !== "false";
  res.json({
    spots: await listSpotsLive({
      onlyAvailable,
      blockId:
        typeof req.query.blockId === "string" ? req.query.blockId : undefined,
      zoneCode:
        typeof req.query.zone === "string" ? req.query.zone : undefined,
    }),
  });
});

router.use(authenticate, requireRole("conductor", "admin"));

router.get("/spots/live", async (req, res) => {
  res.json({
    spots: await listSpotsLive({
      blockId:
        typeof req.query.blockId === "string" ? req.query.blockId : undefined,
      zoneCode:
        typeof req.query.zone === "string" ? req.query.zone : undefined,
      viewerUserId: req.user!.id,
    }),
    refreshedAt: new Date().toISOString(),
  });
});

router.get("/blocks", async (req, res) => {
  const blocks = await listParkingBlocks({
    zoneId:
      typeof req.query.zoneId === "string" ? req.query.zoneId : undefined,
  });
  res.json({ blocks });
});

router.get("/zones/:id", async (req, res) => {
  const zone = await getParkingZone(req.params.id);
  if (!zone) {
    return res.status(404).json({ error: "Zona no encontrada." });
  }
  res.json({
    zone: {
      id: zone.id,
      code: zone.code,
      name: zone.name,
      region: zone.region,
      hasImage: zone.hasImage,
      imageMimeType: zone.imageMimeType,
      imageBase64: zone.imageBase64,
    },
  });
});

router.get("/blocks/nearby", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: "lat y lng son obligatorios." });
  }
  const blocks = await listParkingBlocks();
  const withDist = blocks
    .map((b) => {
      if (b.lat == null || b.lng == null) return { ...b, distanceM: null };
      const R = 6371e3;
      const φ1 = (lat * Math.PI) / 180;
      const φ2 = (b.lat * Math.PI) / 180;
      const Δφ = ((b.lat - lat) * Math.PI) / 180;
      const Δλ = ((b.lng - lng) * Math.PI) / 180;
      const a =
        Math.sin(Δφ / 2) ** 2 +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
      const distanceM = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...b, distanceM: Math.round(distanceM) };
    })
    .sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  res.json({ blocks: withDist });
});

router.post("/spots/:id/hold", async (req, res) => {
  try {
    const result = await createSpotHold(req.params.id, req.user!, req.body ?? {});
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.get("/holds/:id", async (req, res) => {
  const hold = await getSpotHold(req.params.id, req.user!.id);
  if (!hold) {
    return res.status(404).json({ error: "Reserva temporal no encontrada." });
  }
  res.json({ hold });
});

router.delete("/holds/:id", async (req, res) => {
  const ok = await cancelSpotHold(req.params.id, req.user!.id);
  if (!ok) {
    return res.status(404).json({ error: "Reserva temporal no encontrada." });
  }
  res.json({ message: "Plaza liberada." });
});

router.post("/holds/:id/pay", async (req, res) => {
  try {
    const method =
      req.body?.paymentMethod === "mercadopago" ? "mercadopago" : "cash";
    const result = await confirmSpotHold(req.params.id, req.user!, method);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.get("/vehicles", async (req, res) => {
  if (req.user!.role === "conductor") {
    await syncGovVehicles(req.user!.id);
  }
  const userId =
    req.user!.role === "admin" && typeof req.query.userId === "string"
      ? req.query.userId
      : req.user!.id;
  res.json({ vehicles: await listConductorVehicles(userId) });
});

router.post("/vehicles", async (req, res) => {
  try {
    const vehicle = await addConductorVehicle(req.user!.id, req.body ?? {});
    res.status(201).json({ vehicle });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.delete("/vehicles/:id", async (req, res) => {
  const ok = await deleteConductorVehicle(req.user!.id, req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "Vehículo no encontrado." });
  }
  res.json({ message: "Vehículo eliminado." });
});

router.get("/parking-alerts", async (req, res) => {
  if (req.user!.role === "conductor") {
    await syncGovVehicles(req.user!.id);
  }
  const userId =
    req.user!.role === "admin" && typeof req.query.userId === "string"
      ? req.query.userId
      : req.user!.id;
  res.json({ alerts: await listParkingAlerts(userId) });
});

router.get("/reservations", async (req, res) => {
  const filter =
    req.user!.role === "admin" ? {} : { userId: req.user!.id };
  res.json({ reservations: await listReservations(filter) });
});

router.delete("/reservations/:id", async (req, res) => {
  try {
    const reservation = await cancelReservation(req.params.id, req.user!);
    if (!reservation) {
      return res.status(404).json({ error: "Reserva no encontrada." });
    }
    res.json({ reservation });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.get("/config", (_req, res) => {
  res.json({
    maxAdvanceMinutes: MAX_RESERVATION_ADVANCE_MS / 60_000,
    holdPaymentMinutes: SPOT_HOLD_MS / 60_000,
  });
});

export default router;
