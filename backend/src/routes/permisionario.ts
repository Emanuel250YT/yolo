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
import { asList, paginationMeta, parsePaginationQuery } from "../lib/pagination.js";
import { listParkingBlocks } from "../store/parkingBlocks.js";
import { getParkingZone } from "../store/parkingZones.js";
import { listSpotsLive, setSpotOccupancy } from "../store/spots.js";
import { getUserAssignedZoneCodes, userCanAccessZone } from "../store/userZones.js";
import { findById } from "../store/users.js";

const router = Router();
router.use(authenticate, requireRole("admin", "permisionario", "municipio"));

router.get("/permits", async (req, res) => {
  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const status =
    typeof req.query.status === "string" ? (req.query.status as import("../prisma/client.js").PermitStatus) : undefined;
  const filter =
    req.user!.role === "permisionario"
      ? { permisionarioId: req.user!.id, status, pagination }
      : { status, pagination };
  const result = await listPermits(filter);
  if (Array.isArray(result)) {
    return res.json({ permits: result, total: result.length, page: 1, pageSize: result.length, hasMore: false, totalPages: 1 });
  }
  res.json({ permits: result.items, ...paginationMeta(result) });
});

router.get("/zones/:id", async (req, res) => {
  const zone = await getParkingZone(req.params.id);
  if (!zone) {
    return res.status(404).json({ error: "Zona no encontrada." });
  }
  if (req.user!.role === "permisionario") {
    const u = await findById(req.user!.id);
    if (!u) return res.status(403).json({ error: "No autorizado." });
    const ok = await userCanAccessZone(req.user!.id, zone, {
      parkingZoneId: u.parkingZoneId,
      zone: u.zone,
    });
    if (!ok) return res.status(403).json({ error: "No autorizado." });
  }
  res.json({ zone });
});

router.get("/blocks", async (req, res) => {
  let zoneId =
    typeof req.query.zoneId === "string" ? req.query.zoneId : undefined;
  if (req.user!.role === "permisionario") {
    const u = await findById(req.user!.id);
    const codes = await getUserAssignedZoneCodes(req.user!.id);
    if (codes.length) {
      const blocks = asList(await listParkingBlocks({ zoneId }));
      const filtered = blocks.filter((b) =>
        codes.includes(b.zoneCode ?? ""),
      );
      return res.json({ blocks: filtered });
    }
    if (u?.parkingZoneId) zoneId = u.parkingZoneId;
  }
  const blocks = asList(await listParkingBlocks({ zoneId }));
  res.json({ blocks });
});

router.get("/spots/live", async (req, res) => {
  let zoneCode =
    typeof req.query.zone === "string" ? req.query.zone : undefined;
  let blockId =
    typeof req.query.blockId === "string" ? req.query.blockId : undefined;

  if (req.user!.role === "permisionario") {
    const codes = await getUserAssignedZoneCodes(req.user!.id);
    if (codes.length > 1) {
      const spots = await listSpotsLive({
        blockId,
        viewerUserId: req.user!.id,
      });
      return res.json({
        spots: spots.filter((s) => codes.includes(s.zone)),
        refreshedAt: new Date().toISOString(),
      });
    }
    if (codes.length === 1) {
      zoneCode = codes[0];
    } else {
      const u = await findById(req.user!.id);
      zoneCode = u?.zone ?? zoneCode;
    }
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
  const pagination = parsePaginationQuery(req.query as Record<string, unknown>);
  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
  const filter =
    req.user!.role === "permisionario"
      ? { userId: req.user!.id, action, entityType, pagination }
      : { action, entityType, pagination };
  const result = await listHistory(filter);
  if (Array.isArray(result)) {
    return res.json({ history: result, total: result.length, page: 1, pageSize: result.length, hasMore: false, totalPages: 1 });
  }
  res.json({ history: result.items, ...paginationMeta(result) });
});

export default router;
