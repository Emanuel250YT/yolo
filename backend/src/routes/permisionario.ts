import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { listHistory } from "../store/history.js";
import {
  addObservation,
  createPermit,
  getPermit,
  listPermits,
  updatePermit,
} from "../store/permits.js";
import { listParkingBlocks } from "../store/parkingBlocks.js";
import { getParkingZone } from "../store/parkingZones.js";
import { listSpotsLive, setSpotOccupancy } from "../store/spots.js";
import { findById } from "../store/users.js";

const router = Router();
router.use(authenticate, requireRole("admin", "permisionario", "municipio"));

router.get("/permits", async (req, res) => {
  const filter =
    req.user!.role === "permisionario"
      ? { permisionarioId: req.user!.id }
      : {};
  res.json({ permits: await listPermits(filter) });
});

router.get("/zones/:id", async (req, res) => {
  const zone = await getParkingZone(req.params.id);
  if (!zone) {
    return res.status(404).json({ error: "Zona no encontrada." });
  }
  if (req.user!.role === "permisionario") {
    const u = await findById(req.user!.id);
    if (u?.zone !== zone.code && u?.parkingZoneId !== zone.id) {
      return res.status(403).json({ error: "No autorizado." });
    }
  }
  res.json({ zone });
});

router.get("/blocks", async (req, res) => {
  let zoneId =
    typeof req.query.zoneId === "string" ? req.query.zoneId : undefined;
  if (req.user!.role === "permisionario") {
    const u = await findById(req.user!.id);
    if (u?.parkingZoneId) zoneId = u.parkingZoneId;
  }
  const blocks = await listParkingBlocks({ zoneId });
  res.json({ blocks });
});

router.get("/spots/live", async (req, res) => {
  let zoneCode =
    typeof req.query.zone === "string" ? req.query.zone : undefined;
  let blockId =
    typeof req.query.blockId === "string" ? req.query.blockId : undefined;

  if (req.user!.role === "permisionario") {
    const u = await findById(req.user!.id);
    zoneCode = u?.zone ?? zoneCode;
  }

  res.json({
    spots: await listSpotsLive({
      zoneCode,
      blockId,
      viewerUserId: req.user!.id,
    }),
    refreshedAt: new Date().toISOString(),
  });
});

router.patch("/spots/:id/occupancy", async (req, res) => {
  try {
    const u =
      req.user!.role === "permisionario"
        ? await findById(req.user!.id)
        : req.user!;
    const spot = await setSpotOccupancy(
      req.params.id,
      req.body?.occupied !== false,
      {
        id: req.user!.id,
        role: req.user!.role,
        zone: u?.zone ?? null,
      },
    );
    res.json({ spot });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.post("/permits", async (req, res) => {
  try {
    const permit = await createPermit(req.body ?? {}, req.user!);
    res.status(201).json({ permit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.patch("/permits/:id", async (req, res) => {
  try {
    const permit = await updatePermit(
      req.params.id,
      req.body ?? {},
      req.user!,
    );
    if (!permit) {
      return res.status(404).json({ error: "Permiso no encontrado." });
    }
    res.json({ permit });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.post("/permits/:id/observations", async (req, res) => {
  try {
    const text = req.body?.observation ?? req.body?.text;
    const permit = await addObservation(req.params.id, text, req.user!);
    if (!permit) {
      return res.status(404).json({ error: "Permiso no encontrado." });
    }
    res.json({
      permit,
      message: "Observación registrada en el historial.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.get("/permits/:id/history", async (req, res) => {
  const permit = await getPermit(req.params.id);
  if (!permit) {
    return res.status(404).json({ error: "Permiso no encontrado." });
  }
  if (
    req.user!.role === "permisionario" &&
    permit.permisionarioId !== req.user!.id
  ) {
    return res.status(403).json({ error: "No autorizado." });
  }
  res.json({ history: await listHistory({ permitId: req.params.id }) });
});

router.get("/history", async (req, res) => {
  const filter =
    req.user!.role === "permisionario"
      ? { userId: req.user!.id, limit: Number(req.query.limit) || 100 }
      : { limit: Number(req.query.limit) || 200 };
  res.json({ history: await listHistory(filter) });
});

export default router;
