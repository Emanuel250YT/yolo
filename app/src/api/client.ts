import type {
  AdminOverview,
  AuthResponse,
  HistoryEntry,
  ParkingZone,
  Permit,
  QuotePayload,
  QuoteResult,
  RegisterPayload,
  RegistrationConfig,
  Reservation,
  Session,
  ShiftStatus,
  Spot,
  TariffsResponse,
  User,
} from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "sem_token";

export interface ApiErrorBody {
  error?: string;
  inactive?: boolean;
  pendingActivation?: boolean;
  role?: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: ApiErrorBody = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  get inactiveAccount() {
    return this.status === 403 && Boolean(this.body.inactive);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errBody = body as ApiErrorBody;
    throw new ApiError(
      errBody.error ?? `Error ${res.status}`,
      res.status,
      errBody,
    );
  }

  return body as T;
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  authConfig: () => request<RegistrationConfig>("/auth/config"),

  register: (payload: RegisterPayload) =>
    request<AuthResponse & { message?: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: () => request<{ user: User }>("/auth/me"),

  municipioUsers: () => request<{ users: User[] }>("/municipio/users"),
  municipioPendingUsers: () =>
    request<{ users: User[] }>("/municipio/users?pending=true"),
  municipioCreateUser: (payload: Record<string, unknown>) =>
    request<{ user: User }>("/municipio/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  municipioActivateUser: (id: string) =>
    request<{ user: User; message: string }>(
      `/municipio/users/${id}/activate`,
      { method: "PATCH" },
    ),

  tariffs: () => request<TariffsResponse>("/tariffs"),
  shiftStatus: () => request<ShiftStatus>("/shifts/status"),
  quote: (payload: QuotePayload) =>
    request<QuoteResult>("/quote", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Admin
  adminOverview: () => request<AdminOverview>("/admin/overview"),
  adminUsers: () => request<{ users: User[] }>("/admin/users"),
  adminCreateUser: (payload: Record<string, unknown>) =>
    request<{ user: User }>("/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  adminUpdateUser: (id: string, payload: Record<string, unknown>) =>
    request<{ user: User }>(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  adminHistory: () => request<{ history: HistoryEntry[] }>("/admin/history"),
  adminPermits: () => request<{ permits: Permit[] }>("/admin/permits"),
  adminReservations: () =>
    request<{ reservations: Reservation[] }>("/admin/reservations"),
  adminSpots: () => request<{ spots: Spot[] }>("/admin/spots"),

  parkingZones: () => request<{ zones: ParkingZone[] }>("/parking-zones"),

  adminParkingZones: () =>
    request<{ zones: ParkingZone[] }>("/admin/parking-zones"),
  adminParkingZone: (id: string) =>
    request<{ zone: ParkingZone }>(`/admin/parking-zones/${id}`),
  adminCreateParkingZone: (payload: Record<string, unknown>) =>
    request<{ zone: ParkingZone }>("/admin/parking-zones", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  adminUpdateParkingZone: (id: string, payload: Record<string, unknown>) =>
    request<{ zone: ParkingZone }>(`/admin/parking-zones/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  adminDeleteParkingZone: (id: string) =>
    request<{ message: string }>(`/admin/parking-zones/${id}`, {
      method: "DELETE",
    }),

  // Permisionario
  permits: () => request<{ permits: Permit[] }>("/permisionario/permits"),
  createPermit: (payload: Record<string, unknown>) =>
    request<{ permit: Permit }>("/permisionario/permits", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePermit: (id: string, payload: Record<string, unknown>) =>
    request<{ permit: Permit }>(`/permisionario/permits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  addObservation: (id: string, observation: string) =>
    request<{ permit: Permit }>(`/permisionario/permits/${id}/observations`, {
      method: "POST",
      body: JSON.stringify({ observation }),
    }),
  permitHistory: (id: string) =>
    request<{ history: HistoryEntry[] }>(
      `/permisionario/permits/${id}/history`,
    ),
  permHistory: () =>
    request<{ history: HistoryEntry[] }>("/permisionario/history"),

  // Conductor
  spots: (available = true) =>
    request<{ spots: Spot[] }>(
      `/conductor/spots?available=${available ? "true" : "false"}`,
    ),
  reservations: () =>
    request<{ reservations: Reservation[] }>("/conductor/reservations"),
  createReservation: (payload: Record<string, unknown>) =>
    request<{ reservation: Reservation }>("/conductor/reservations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  cancelReservation: (id: string) =>
    request<{ reservation: Reservation }>(`/conductor/reservations/${id}`, {
      method: "DELETE",
    }),
  conductorConfig: () =>
    request<{ maxAdvanceMinutes: number }>("/conductor/config"),

  // Sessions (permisionario/admin)
  listSessions: () => request<{ sessions: Session[] }>("/sessions"),
  createSession: (payload: Record<string, unknown>) =>
    request<{ session: Session }>("/sessions", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  checkout: (id: string, digitalPayment?: boolean) =>
    request<{ session: Session }>(`/sessions/${id}/checkout`, {
      method: "POST",
      body: JSON.stringify(
        digitalPayment !== undefined ? { digitalPayment } : {},
      ),
    }),
};
