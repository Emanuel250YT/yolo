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

router.get("/permits", async (req, res) => {
  const filter =
    req.user!.role === "permisionario"
      ? { permisionarioId: req.user!.id }
      : {};
  res.json({ permits: await listPermits(filter) });
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
