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

const router = Router();
router.use(authenticate, requireRole("admin", "permisionario"));

router.get("/permits", (req, res) => {
  const filter =
    req.user.role === "permisionario"
      ? { permisionarioId: req.user.id }
      : {};
  res.json({ permits: listPermits(filter) });
});

router.post("/permits", (req, res) => {
  try {
    const permit = createPermit(req.body ?? {}, req.user);
    res.status(201).json({ permit });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/permits/:id", (req, res) => {
  try {
    const permit = updatePermit(req.params.id, req.body ?? {}, req.user);
    if (!permit) return res.status(404).json({ error: "Permiso no encontrado." });
    res.json({ permit });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/permits/:id/observations", (req, res) => {
  try {
    const permit = addObservation(
      req.params.id,
      req.body?.observation ?? req.body?.text,
      req.user,
    );
    if (!permit) return res.status(404).json({ error: "Permiso no encontrado." });
    res.json({ permit, message: "Observación registrada en el historial." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/permits/:id/history", (req, res) => {
  const permit = getPermit(req.params.id);
  if (!permit) return res.status(404).json({ error: "Permiso no encontrado." });
  if (
    req.user.role === "permisionario" &&
    permit.permisionarioId !== req.user.id
  ) {
    return res.status(403).json({ error: "No autorizado." });
  }
  res.json({ history: listHistory({ permitId: req.params.id }) });
});

router.get("/history", (req, res) => {
  const filter =
    req.user.role === "permisionario"
      ? { userId: req.user.id, limit: Number(req.query.limit) || 100 }
      : { limit: Number(req.query.limit) || 200 };
  res.json({ history: listHistory(filter) });
});

export default router;
