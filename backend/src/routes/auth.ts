import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { getAppMeta } from "../config/appMeta.js";
import { isDevToolsEnabled } from "../config/devTools.js";
import { authResponse } from "../services/authTokens.js";
import {
  getRegistrationConfig,
  registerPublicUser,
} from "../services/registration.js";
import {
  findByEmail,
  findById,
  sanitizeUser,
  setPassword,
  verifyPassword,
} from "../store/users.js";

const router = Router();

router.get("/config", (_req, res) => {
  res.json({
    ...getRegistrationConfig(),
    devTools: isDevToolsEnabled(),
    ...getAppMeta(),
  });
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

router.get("/me", authenticate, async (req, res) => {
  const user = await findById(req.user!.id);
  if (!user) {
    return res.status(404).json({ error: "Usuario no encontrado." });
  }
  res.json({ user: sanitizeUser(user) });
});

router.post("/me/password", authenticate, async (req, res) => {
  try {
    const currentPassword =
      typeof req.body?.currentPassword === "string"
        ? req.body.currentPassword
        : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!currentPassword || !password) {
      return res
        .status(400)
        .json({ error: "La contraseña actual y la nueva son obligatorias." });
    }

    const user = await findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }

    if (!(await verifyPassword(user, currentPassword))) {
      return res.status(401).json({ error: "La contraseña actual es incorrecta." });
    }

    const updated = await setPassword(user.id, password);
    res.json({ user: updated, message: "Contraseña actualizada correctamente." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    res.status(400).json({ error: message });
  }
});

export default router;
