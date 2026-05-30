import { Router } from "express";
import { getFrontendUrl } from "../config/appUrls.js";
import {
  exchangeMercadoPagoCode,
  verifyMercadoPagoState,
} from "../services/mercadopagoOAuth.js";
import { linkMercadoPagoAccount } from "../store/mercadopago.js";

const router = Router();

async function handleOAuthCallback(
  req: { query: Record<string, unknown> },
  res: { redirect: (url: string) => void },
) {
  const frontendUrl = getFrontendUrl();
  const redirectBase = `${frontendUrl}/?tab=cuenta`;

  const oauthError =
    typeof req.query.error === "string" ? req.query.error : null;
  if (oauthError) {
    console.warn("[MP OAuth] Usuario rechazó autorización:", oauthError);
    return res.redirect(`${redirectBase}&mp=error&reason=${oauthError}`);
  }

  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";

  if (!code || !state) {
    console.warn("[MP OAuth] Callback sin code o state");
    return res.redirect(`${redirectBase}&mp=error&reason=missing_params`);
  }

  try {
    const userId = verifyMercadoPagoState(state);
    console.info("[MP OAuth] Callback recibido, intercambiando code por token…");

    const tokens = await exchangeMercadoPagoCode(code);
    await linkMercadoPagoAccount(userId, tokens);

    console.info("[MP OAuth] Cuenta vinculada para permisionario:", userId);
    return res.redirect(`${redirectBase}&mp=linked`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "oauth_failed";
    console.error("[MP OAuth] Falló el callback:", reason);
    return res.redirect(
      `${redirectBase}&mp=error&reason=${encodeURIComponent(reason)}`,
    );
  }
}

router.get("/callback", (req, res) => {
  void handleOAuthCallback(req, res);
});

export default router;
