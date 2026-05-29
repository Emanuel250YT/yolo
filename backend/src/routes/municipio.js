import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { registerStaffByMunicipio } from "../services/registration.js";
import { listUsers, sanitizeUser, updateUser } from "../store/users.js";

const router = Router();
router.use(authenticate, requireRole("municipio"));

router.get("/users", (req, res) => {
  const pending = req.query.pending === "true";
  const users = listUsers(
    pending ? { activationPending: true } : {},
  ).filter((u) => u.role !== "municipio");
  res.json({ users });
});

router.post("/users", async (req, res) => {
  try {
    const full = await registerStaffByMunicipio(req.body, req.user);
    res.status(201).json(full);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/users/:id/activate", (req, res) => {
  try {
    const user = updateUser(req.params.id, {
      active: true,
      activationPending: false,
    });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
    res.json({ user, message: "Cuenta habilitada. Ya puede iniciar sesión." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch("/users/:id/deactivate", (req, res) => {
  try {
    const target = listUsers().find((u) => u.id === req.params.id);
    if (target?.role === "municipio") {
      return res.status(400).json({ error: "No se puede desactivar la cuenta Municipio." });
    }
    const user = updateUser(req.params.id, { active: false });
    if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
