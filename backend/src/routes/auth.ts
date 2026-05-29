import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { authResponse } from "../services/authTokens.js";
import {
  getRegistrationConfig,
  registerPublicUser,
} from "../services/registration.js";
import { findByEmail, sanitizeUser, verifyPassword } from "../store/users.js";

const router = Router();

router.get("/config", (_req, res) => {
  res.json(getRegistrationConfig());
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res
      .status(400)
      .json({ error: "Email y contraseña son obligatorios." });
  }

  const user = await findByEmail(email);
  if (!user || !(await verifyPassword(user, password))) {
    return res.status(401).json({ error: "Credenciales incorrectas." });
  }

  if (!user.active) {
    const msg = user.activationPending
      ? "Tu cuenta está inactiva. La Municipalidad aún no completó tu alta; te notificaremos cuando puedas ingresar al sistema."
      : "Tu cuenta está inactiva. Contactá al SEM para más información.";
    return res.status(403).json({
      error: msg,
      inactive: true,
      pendingActivation: Boolean(user.activationPending),
      role: user.role,
    });
  }

  res.json(authResponse(sanitizeUser(user)));
});

router.post("/register", async (req, res) => {
  try {
    const result = await registerPublicUser(req.body ?? {});
    const payload = {
      message: result.message,
      user: result.user,
    };
    if (result.autoLogin) {
      return res.status(201).json({ ...authResponse(result.user), ...payload });
    }
    res.status(201).json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

export default router;
