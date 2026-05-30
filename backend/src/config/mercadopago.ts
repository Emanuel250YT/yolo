import { getApiPublicUrl, getFrontendUrl } from "./appUrls.js";

export function getMercadoPagoConfig() {
  const apiPublicUrl = getApiPublicUrl();
  const frontendUrl = getFrontendUrl();
  return {
    clientId: process.env.MP_CLIENT_ID ?? "2988781161305187",
    clientSecret: process.env.MP_CLIENT_SECRET ?? "",
    publicKey: process.env.MP_PUBLIC_KEY ?? "",
    redirectUri:
      process.env.MP_REDIRECT_URI ?? `${apiPublicUrl}/oauth/callback`,
    authBaseUrl: "https://auth.mercadopago.com.ar/authorization",
    tokenUrl: "https://api.mercadopago.com/oauth/token",
    preferencesUrl: "https://api.mercadopago.com/checkout/preferences",
    paymentsUrl: "https://api.mercadopago.com/v1/payments",
    notificationUrl:
      process.env.MP_NOTIFICATION_URL ??
      `${apiPublicUrl}/api/payments/webhook`,
    frontendUrl,
  };
}

export function paymentBrickUrl(orderRef: string) {
  return `${getFrontendUrl()}/payment-brick?order-id=${orderRef}`;
}
