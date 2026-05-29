import type {
  HealthResponse,
  QuotePayload,
  QuoteResult,
  Session,
  SessionsResponse,
  ShiftStatus,
  TariffsResponse,
} from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      (body as { error?: string }).error ?? `Error ${res.status}`,
      res.status,
    );
  }

  return body as T;
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  tariffs: () => request<TariffsResponse>("/tariffs"),

  shiftStatus: () => request<ShiftStatus>("/shifts/status"),

  quote: (payload: QuotePayload) =>
    request<QuoteResult>("/quote", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  listSessions: (status?: string) => {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    return request<SessionsResponse>(`/sessions${q}`);
  },

  createSession: (payload: {
    plate: string;
    vehicleType: "auto" | "motorcycle";
    zone?: string;
    digitalPayment?: boolean;
    permitId?: string;
  }) =>
    request<{ session: Session }>("/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getSession: (id: string) =>
    request<{ session: Session }>(`/sessions/${id}`),

  checkout: (id: string, digitalPayment?: boolean) =>
    request<{ session: Session }>(`/sessions/${id}/checkout`, {
      method: "POST",
      body: JSON.stringify(
        digitalPayment !== undefined ? { digitalPayment } : {},
      ),
    }),
};
