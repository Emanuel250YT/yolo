import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/auth.js";
import { getMercadoPagoConfig } from "../config/mercadopago.js";

interface MpOAuthState {
  sub: string;
  typ: "mp_oauth";
}

interface MpTokenResponse {
  access_token?: string;
  refresh_token?: string;
  user_id?: number;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  live_mode?: boolean;
  error?: string;
  message?: string;
  status?: number;
  cause?: unknown[];
}

export interface MercadoPagoTokens {
  accessToken: string;
  refreshToken: string | null;
  mercadoPagoUserId: string | null;
  expiresIn: number | null;
}

export function buildMercadoPagoAuthUrl(userId: string) {
  const { clientId, redirectUri, authBaseUrl } = getMercadoPagoConfig();
  const state = jwt.sign(
    { sub: userId, typ: "mp_oauth" } satisfies MpOAuthState,
    JWT_SECRET,
    { expiresIn: "15m" },
  );

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: redirectUri,
    state,
  });

  return `${authBaseUrl}?${params.toString()}`;
}

export function verifyMercadoPagoState(state: string): string {
  const payload = jwt.verify(state, JWT_SECRET) as MpOAuthState;
  if (payload.typ !== "mp_oauth" || !payload.sub) {
    throw new Error("Estado OAuth inválido.");
  }
  return payload.sub;
}

function mpErrorMessage(data: MpTokenResponse, status: number) {
  const parts = [
    data.message,
    data.error,
    Array.isArray(data.cause)
      ? data.cause
          .map((c) =>
            typeof c === "object" && c && "description" in c
              ? String((c as { description?: string }).description)
              : null,
          )
          .filter(Boolean)
          .join("; ")
      : null,
  ].filter(Boolean);
  return (
    parts.join(" — ") ||
    `Mercado Pago respondió ${status} al intercambiar el código.`
  );
}

/** Intercambia el `code` del callback por access_token + refresh_token. */
export async function exchangeMercadoPagoCode(
  code: string,
): Promise<MercadoPagoTokens> {
  const { clientId, clientSecret, redirectUri, tokenUrl } =
    getMercadoPagoConfig();

  if (!clientSecret) {
    throw new Error("MP_CLIENT_SECRET no está configurado en el servidor.");
  }

  if (clientSecret.startsWith("APP_USR-")) {
    throw new Error(
      "MP_CLIENT_SECRET parece un Access Token (APP_USR-). Usá el Client Secret de tu aplicación en developers.mercadopago.com.",
    );
  }

  const payload = {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  };

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as MpTokenResponse;

  if (!res.ok || !data.access_token) {
    console.error("[MP OAuth] Error al obtener token:", {
      status: res.status,
      error: data.error,
      message: data.message,
    });
    throw new Error(mpErrorMessage(data, res.status));
  }

  console.info("[MP OAuth] Token obtenido para user_id:", data.user_id);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    mercadoPagoUserId: data.user_id != null ? String(data.user_id) : null,
    expiresIn: data.expires_in ?? null,
  };
}

/** Renueva el access_token con refresh_token. */
export async function refreshMercadoPagoToken(refreshToken: string) {
  const { clientId, clientSecret, tokenUrl } = getMercadoPagoConfig();

  if (!clientSecret) {
    throw new Error("MP_CLIENT_SECRET no está configurado en el servidor.");
  }

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as MpTokenResponse;
  if (!res.ok || !data.access_token) {
    throw new Error(mpErrorMessage(data, res.status));
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    mercadoPagoUserId: data.user_id != null ? String(data.user_id) : null,
    expiresIn: data.expires_in ?? null,
  };
}
