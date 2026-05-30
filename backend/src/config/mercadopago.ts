import { getApiPublicUrl } from "./appUrls.js";

export function getMercadoPagoConfig() {
  const apiPublicUrl = getApiPublicUrl();
  return {
    clientId: process.env.MP_CLIENT_ID ?? "2988781161305187",
    clientSecret: process.env.MP_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.MP_REDIRECT_URI ?? `${apiPublicUrl}/oauth/callback`,
    authBaseUrl: "https://auth.mercadopago.com.ar/authorization",
    tokenUrl: "https://api.mercadopago.com/oauth/token",
  };
}
