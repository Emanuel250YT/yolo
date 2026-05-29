import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import { registerStaffByMunicipio } from "../services/registration.js";
import { listUsers, updateUser } from "../store/users.js";

const router = Router();
router.use(authenticate, requireRole("municipio"));

router.get("/users", async (req, res) => {
  const pending = req.query.pending === "true";
  const users = await listUsers(
    pending ? { activationPending: true } : {},
  );
  res.json({
    users: users.filter((u) => u.role !== "municipio"),
  });
});

router.post("/users", async (req, res) => {
  try {
    const result = await registerStaffByMunicipio(req.body ?? {});
    res.status(201).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.patch("/users/:id/activate", async (req, res) => {
  try {
    const user = await updateUser(req.params.id, {
      active: true,
      activationPending: false,
    });
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    res.json({
      user,
      message: "Cuenta habilitada. Ya puede iniciar sesión.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.patch("/users/:id/deactivate", async (req, res) => {
  try {
    const users = await listUsers();
    const target = users.find((u) => u.id === req.params.id);
    if (target?.role === "municipio") {
      return res.status(400).json({
        error: "No se puede desactivar la cuenta Municipio.",
      });
    }
    const user = await updateUser(req.params.id, { active: false });
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    res.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

export default router;
