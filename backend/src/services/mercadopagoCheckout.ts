import { randomUUID } from "node:crypto";
import { getMercadoPagoConfig } from "../config/mercadopago.js";
import { getValidMercadoPagoAccessToken } from "../store/mercadopago.js";

export interface CreatePreferenceInput {
  permisionarioId: string;
  orderRef: string;
  title: string;
  description?: string;
  amount: number;
  currencyId?: string;
}

interface PreferenceResponse {
  id?: string;
  init_point?: string;
  error?: string;
  message?: string;
  cause?: { description?: string }[];
}

export async function createMercadoPagoPreference(input: CreatePreferenceInput) {
  const accessToken = await getValidMercadoPagoAccessToken(input.permisionarioId);
  const { preferencesUrl, notificationUrl, frontendUrl } = getMercadoPagoConfig();

  const body = {
    items: [
      {
        id: input.orderRef,
        title: input.title,
        description: input.description ?? input.title,
        quantity: 1,
        currency_id: input.currencyId ?? "ARS",
        unit_price: input.amount,
      },
    ],
    external_reference: input.orderRef,
    notification_url: notificationUrl,
    back_urls: {
      success: `${frontendUrl}/payment-brick?order-id=${input.orderRef}&status=success`,
      pending: `${frontendUrl}/payment-brick?order-id=${input.orderRef}&status=pending`,
      failure: `${frontendUrl}/payment-brick?order-id=${input.orderRef}&status=failure`,
    },
    auto_return: "approved",
    statement_descriptor: "SEM SALTA",
    expires: true,
    expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };

  const res = await fetch(preferencesUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as PreferenceResponse;

  if (!res.ok || !data.id) {
    const detail =
      data.message ??
      data.error ??
      data.cause?.map((c) => c.description).filter(Boolean).join("; ") ??
      `HTTP ${res.status}`;
    throw new Error(`No se pudo crear la preferencia MP: ${detail}`);
  }

  return {
    preferenceId: data.id,
    initPoint: data.init_point ?? null,
  };
}

interface PaymentResponse {
  id?: number;
  status?: string;
  status_detail?: string;
  error?: string;
  message?: string;
  cause?: { description?: string }[];
}

export async function processMercadoPagoPayment(
  permisionarioId: string,
  orderRef: string,
  formData: Record<string, unknown>,
) {
  const accessToken = await getValidMercadoPagoAccessToken(permisionarioId);
  const { paymentsUrl } = getMercadoPagoConfig();

  const payload = {
    ...formData,
    external_reference: orderRef,
  };

  const res = await fetch(paymentsUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as PaymentResponse;

  if (!res.ok) {
    const detail =
      data.message ??
      data.error ??
      data.cause?.map((c) => c.description).filter(Boolean).join("; ") ??
      `HTTP ${res.status}`;
    throw new Error(detail);
  }

  return {
    paymentId: data.id != null ? String(data.id) : null,
    status: data.status ?? "unknown",
    statusDetail: data.status_detail ?? null,
  };
}
