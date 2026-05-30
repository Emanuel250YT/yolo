import type {
  AdminOverview,
  AuthResponse,
  ConductorVehicle,
  DashboardStats,
  HistoryEntry,
  PaginatedMeta,
  ParkingAlert,
  ParkingBlock,
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
  SpotHold,
  Tariffs,
  TariffsResponse,
  User,
  UserRole,
  DevSpotSimStatus,
  PaymentOrderInfo,
  PaymentOrderPublic,
} from "../types";
import { getDevHeaders } from "../dev/devConfig";

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
      ...getDevHeaders(),
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

export interface ListQuery extends Record<string, string | number | boolean | undefined> {
  page?: number;
  pageSize?: number;
  q?: string;
}

function buildQuery(params?: ListQuery) {
  const qs = new URLSearchParams();
  if (!params) return "";
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.q) qs.set("q", params.q);
  for (const [k, v] of Object.entries(params)) {
    if (k === "page" || k === "pageSize" || k === "q") continue;
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function unwrapPaginated<TKey extends string, TItem>(
  key: TKey,
  res: PaginatedList<TKey, TItem>,
) {
  return {
    items: res[key],
    total: res.total,
    page: res.page,
    pageSize: res.pageSize,
    totalPages: res.totalPages,
    hasMore: res.hasMore,
  };
}

export type PaginatedList<TKey extends string, TItem> = Record<TKey, TItem[]> &
  PaginatedMeta;

function zoneOptionsFromList(zones: ParkingZone[]) {
  return zones.map((z) => ({
    value: z.id,
    label: `${z.name} (${z.code})`,
    keywords: `${z.ref ?? ""} ${z.region}`,
  }));
}

export const api = {
  health: () => request<{ status: string }>("/health"),

  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  authConfig: () => request<RegistrationConfig>("/auth/config"),

  syncDevClock: (payload: { enabled: boolean; iso?: string | null }) =>
    request<{ clock: { enabled: boolean; iso: string | null } }>("/dev/clock", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  runDevExpiry: () =>
    request<{
      result: {
        at: string;
        simulated: boolean;
        permitsExpired: number;
        holdsExpired: number;
        paymentOrdersExpired: number;
        reservationsExpired: number;
      };
    }>("/dev/expiry/run", { method: "POST" }),

  devSpotSimStatus: () =>
    request<{ status: DevSpotSimStatus }>("/dev/spots/simulate"),

  startDevSpotSim: (zoneCode: string, count: number) =>
    request<{ status: DevSpotSimStatus }>("/dev/spots/simulate/start", {
      method: "POST",
      body: JSON.stringify({ zoneCode, count }),
    }),

  stopDevSpotSim: () =>
    request<{ status: DevSpotSimStatus }>("/dev/spots/simulate/stop", {
      method: "POST",
    }),

  register: (payload: RegisterPayload) =>
    request<AuthResponse & { message?: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  me: () => request<{ user: User }>("/auth/me"),
  changePassword: (currentPassword: string, password: string) =>
    request<{ user: User; message?: string }>("/auth/me/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, password }),
    }),

  municipioUsers: (query?: ListQuery) =>
    request<PaginatedList<"users", User>>(`/municipio/users${buildQuery(query)}`),
  municipioPendingUsers: (query?: ListQuery) =>
    request<PaginatedList<"users", User>>(
      `/municipio/users${buildQuery({ ...query, pending: "true" })}`,
    ),
  municipioCreateUser: (payload: Record<string, unknown>) =>
    request<{ user: User }>("/municipio/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  municipioUpdateUser: (id: string, payload: Record<string, unknown>) =>
    request<{ user: User }>(`/municipio/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  municipioActivateUser: (id: string) =>
    request<{ user: User; message: string }>(
      `/municipio/users/${id}/activate`,
      { method: "PATCH" },
    ),
  municipioDeactivateUser: (id: string) =>
    request<{ user: User }>(`/municipio/users/${id}/deactivate`, {
      method: "PATCH",
    }),
  municipioUpdateTariffs: (payload: Record<string, unknown>) =>
    request<{ tariffs: Tariffs; message?: string }>(
      "/municipio/tariffs",
      { method: "PATCH", body: JSON.stringify(payload) },
    ),
  municipioDashboard: () => request<DashboardStats>("/municipio/dashboard"),
  municipioParkingZones: (query?: ListQuery) =>
    request<PaginatedList<"zones", ParkingZone>>(
      `/municipio/parking-zones${buildQuery(query)}`,
    ),
  municipioParkingZone: (id: string) =>
    request<{ zone: ParkingZone }>(`/municipio/parking-zones/${id}`),
  municipioCreateParkingZone: (payload: Record<string, unknown>) =>
    request<{ zone: ParkingZone }>("/municipio/parking-zones", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  municipioUpdateParkingZone: (id: string, payload: Record<string, unknown>) =>
    request<{ zone: ParkingZone }>(`/municipio/parking-zones/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  municipioDeleteParkingZone: (id: string, force = false) =>
    request<{ message: string }>(
      `/municipio/parking-zones/${id}${force ? "?force=true" : ""}`,
      { method: "DELETE" },
    ),
  municipioParkingZoneDeleteCheck: (id: string) =>
    request<{ blockers: string[]; canSafeDelete: boolean }>(
      `/municipio/parking-zones/${id}/delete-check`,
    ),
  municipioSpotsLive: () =>
    request<{ spots: Spot[]; refreshedAt: string }>("/municipio/spots/live"),
  municipioCreateSpotInZone: (
    zoneId: string,
    payload: {
      lat: number;
      lng: number;
      label?: string;
      spotType?: Spot["spotType"];
    },
  ) =>
    request<{ spot: Spot }>(`/municipio/parking-zones/${zoneId}/spots`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  municipioCreateSpotsAlongLine: (
    zoneId: string,
    payload: {
      points: { lat: number; lng: number }[];
      spacingM?: number;
      spotType?: Spot["spotType"];
    },
  ) =>
    request<{
      spots: Spot[];
      created: number;
      lengthM: number;
      spacingM: number;
    }>(`/municipio/parking-zones/${zoneId}/spots/along-line`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  municipioDeleteSpot: (id: string, force = false) =>
    request<{ message: string }>(
      `/municipio/spots/${id}${force ? "?force=true" : ""}`,
      { method: "DELETE" },
    ),
  municipioUpdateSpot: (
    id: string,
    payload: { spotType?: Spot["spotType"]; label?: string },
  ) =>
    request<{ spot: Spot }>(`/municipio/spots/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  tariffs: () => request<TariffsResponse>("/tariffs"),
  shiftStatus: () => request<ShiftStatus>("/shifts/status"),
  quote: (payload: QuotePayload) =>
    request<QuoteResult>("/quote", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Admin
  adminOverview: () => request<AdminOverview>("/admin/overview"),
  adminDashboard: () => request<DashboardStats>("/admin/dashboard"),
  adminUsers: (query?: ListQuery) =>
    request<PaginatedList<"users", User>>(`/admin/users${buildQuery(query)}`),
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
  adminHistory: (query?: ListQuery) =>
    request<PaginatedList<"history", HistoryEntry>>(
      `/admin/history${buildQuery(query)}`,
    ),
  adminPermits: (query?: ListQuery) =>
    request<PaginatedList<"permits", Permit>>(
      `/admin/permits${buildQuery(query)}`,
    ),
  adminReservations: (query?: ListQuery) =>
    request<PaginatedList<"reservations", Reservation>>(
      `/admin/reservations${buildQuery(query)}`,
    ),
  adminSpots: (query?: ListQuery) =>
    request<PaginatedList<"spots", Spot>>(`/admin/spots${buildQuery(query)}`),

  parkingZones: (query?: ListQuery) =>
    request<PaginatedList<"zones", ParkingZone>>(
      `/parking-zones${buildQuery(query)}`,
    ),
  parkingZoneOptions: async (params: { page: number; q: string }) => {
    const res = await request<PaginatedList<"zones", ParkingZone>>(
      `/parking-zones${buildQuery({ page: params.page, pageSize: 20, q: params.q })}`,
    );
    return {
      options: zoneOptionsFromList(res.zones),
      total: res.total,
      page: res.page,
      pageSize: res.pageSize,
      totalPages: res.totalPages,
      hasMore: res.hasMore,
    };
  },

  adminParkingZones: (query?: ListQuery) =>
    request<PaginatedList<"zones", ParkingZone>>(
      `/admin/parking-zones${buildQuery(query)}`,
    ),
  adminParkingZoneOptions: async (params: { page: number; q: string }) => {
    const res = await request<PaginatedList<"zones", ParkingZone>>(
      `/admin/parking-zones${buildQuery({ page: params.page, pageSize: 20, q: params.q })}`,
    );
    return {
      options: zoneOptionsFromList(res.zones),
      total: res.total,
      page: res.page,
      pageSize: res.pageSize,
      totalPages: res.totalPages,
      hasMore: res.hasMore,
    };
  },
  municipioParkingZoneOptions: async (params: { page: number; q: string }) => {
    const res = await request<PaginatedList<"zones", ParkingZone>>(
      `/municipio/parking-zones${buildQuery({ page: params.page, pageSize: 20, q: params.q })}`,
    );
    return {
      options: zoneOptionsFromList(res.zones),
      total: res.total,
      page: res.page,
      pageSize: res.pageSize,
      totalPages: res.totalPages,
      hasMore: res.hasMore,
    };
  },
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
  adminDeleteParkingZone: (id: string, force = false) =>
    request<{ message: string }>(
      `/admin/parking-zones/${id}${force ? "?force=true" : ""}`,
      { method: "DELETE" },
    ),
  adminParkingZoneDeleteCheck: (id: string) =>
    request<{ blockers: string[]; canSafeDelete: boolean }>(
      `/admin/parking-zones/${id}/delete-check`,
    ),

  adminBlocks: (zoneId?: string, query?: ListQuery) =>
    request<PaginatedList<"blocks", ParkingBlock>>(
      `/admin/blocks${buildQuery({ ...query, zoneId })}`,
    ),
  adminCreateBlock: (payload: Record<string, unknown>) =>
    request<{ block: ParkingBlock }>("/admin/blocks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  adminCreateBlockSpotGrid: (
    blockId: string,
    payload: Record<string, unknown>,
  ) =>
    request<{ created: number }>(`/admin/blocks/${blockId}/spots-grid`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  adminDeleteBlock: (id: string) =>
    request<{ message: string }>(`/admin/blocks/${id}`, {
      method: "DELETE",
    }),
  adminSpotsLive: () =>
    request<{ spots: Spot[]; refreshedAt: string }>("/admin/spots/live"),
  municipioSpots: (query?: ListQuery) =>
    request<PaginatedList<"spots", Spot>>(
      `/municipio/spots${buildQuery(query)}`,
    ),
  adminCreateSpotInZone: (
    zoneId: string,
    payload: {
      lat: number;
      lng: number;
      label?: string;
      spotType?: Spot["spotType"];
    },
  ) =>
    request<{ spot: Spot }>(`/admin/parking-zones/${zoneId}/spots`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  adminCreateSpotsAlongLine: (
    zoneId: string,
    payload: {
      points: { lat: number; lng: number }[];
      spacingM?: number;
      spotType?: Spot["spotType"];
    },
  ) =>
    request<{
      spots: Spot[];
      created: number;
      lengthM: number;
      spacingM: number;
    }>(`/admin/parking-zones/${zoneId}/spots/along-line`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  adminCleanDatabase: () =>
    request<{ message: string; result: Record<string, number> }>(
      "/admin/database/clean",
      {
        method: "POST",
        body: JSON.stringify({ confirm: "LIMPIAR" }),
      },
    ),
  adminCreateSpotAtPoint: (
    blockId: string,
    payload: { lat: number; lng: number; label?: string },
  ) =>
    request<{ spot: Spot }>(`/admin/blocks/${blockId}/spots`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  adminDeleteSpot: (id: string, force = false) =>
    request<{ message: string }>(
      `/admin/spots/${id}${force ? "?force=true" : ""}`,
      { method: "DELETE" },
    ),
  adminUpdateSpot: (
    id: string,
    payload: { spotType?: Spot["spotType"]; label?: string },
  ) =>
    request<{ spot: Spot }>(`/admin/spots/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  adminSetSpotOccupancy: (id: string, occupied: boolean) =>
    request<{ spot: Spot }>(`/admin/spots/${id}/occupancy`, {
      method: "PATCH",
      body: JSON.stringify({ occupied }),
    }),

  // Permisionario
  permits: (query?: ListQuery) =>
    request<PaginatedList<"permits", Permit>>(
      `/permisionario/permits${buildQuery(query)}`,
    ),
  permisionarioControl: () =>
    request<{ permits: Permit[] }>("/permisionario/control"),
  createPermit: (payload: Record<string, unknown>) =>
    request<{ permit: Permit; payment?: PaymentOrderInfo }>(
      "/permisionario/permits",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  updatePermit: (id: string, payload: Record<string, unknown>) =>
    request<{ permit: Permit }>(`/permisionario/permits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  completePermit: (id: string) =>
    request<{ permit: Permit; message?: string }>(
      `/permisionario/permits/${id}/complete`,
      { method: "POST" },
    ),
  extendPermit: (
    id: string,
    payload: { durationMinutes?: number; hours?: number },
  ) =>
    request<{ permit: Permit; payment?: PaymentOrderInfo; message?: string }>(
      `/permisionario/permits/${id}/extend`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  addObservation: (id: string, observation: string) =>
    request<{ permit: Permit }>(`/permisionario/permits/${id}/observations`, {
      method: "POST",
      body: JSON.stringify({ observation }),
    }),
  permitHistory: (id: string) =>
    request<{ history: HistoryEntry[] }>(
      `/permisionario/permits/${id}/history`,
    ),
  getPermitPayment: (id: string) =>
    request<{ payment: PaymentOrderInfo | null }>(
      `/permisionario/permits/${id}/payment`,
    ),
  permHistory: (query?: ListQuery) =>
    request<PaginatedList<"history", HistoryEntry>>(
      `/permisionario/history${buildQuery(query)}`,
    ),
  permisionarioSpotsLive: (opts?: { blockId?: string; zone?: string }) => {
    const q = new URLSearchParams();
    if (opts?.blockId) q.set("blockId", opts.blockId);
    if (opts?.zone) q.set("zone", opts.zone);
    const qs = q.toString();
    return request<{ spots: Spot[]; refreshedAt: string }>(
      `/permisionario/spots/live${qs ? `?${qs}` : ""}`,
    );
  },
  permisionarioSetSpotOccupancy: (id: string, occupied: boolean) =>
    request<{ spot: Spot }>(`/permisionario/spots/${id}/occupancy`, {
      method: "PATCH",
      body: JSON.stringify({ occupied }),
    }),
  permisionarioZone: (id: string) =>
    request<{ zone: ParkingZone }>(`/permisionario/zones/${id}`),
  permisionarioBlocks: (zoneId?: string) =>
    request<{ blocks: ParkingBlock[] }>(
      `/permisionario/blocks${zoneId ? `?zoneId=${zoneId}` : ""}`,
    ),
  mercadoPagoAuthorize: () =>
    request<{ linked: boolean; url: string | null; mercadoPagoUserId?: string }>(
      "/permisionario/mercadopago/authorize",
    ),

  // Conductor
  spots: (available = true) =>
    request<{ spots: Spot[] }>(
      `/conductor/spots?available=${available ? "true" : "false"}`,
    ),
  spotsLive: (opts?: { blockId?: string; zone?: string }) => {
    const q = new URLSearchParams();
    if (opts?.blockId) q.set("blockId", opts.blockId);
    if (opts?.zone) q.set("zone", opts.zone);
    const qs = q.toString();
    return request<{ spots: Spot[]; refreshedAt: string }>(
      `/conductor/spots/live${qs ? `?${qs}` : ""}`,
    );
  },
  conductorBlocks: (zoneId?: string) =>
    request<{ blocks: ParkingBlock[] }>(
      `/conductor/blocks${zoneId ? `?zoneId=${zoneId}` : ""}`,
    ),
  conductorZone: (id: string) =>
    request<{ zone: ParkingZone }>(`/conductor/zones/${id}`),
  conductorBlocksNearby: (lat: number, lng: number) =>
    request<{ blocks: ParkingBlock[] }>(
      `/conductor/blocks/nearby?lat=${lat}&lng=${lng}`,
    ),
  createSpotHold: (spotId: string, payload: Record<string, unknown>) =>
    request<{ hold: SpotHold; paymentDeadlineMs: number }>(
      `/conductor/spots/${spotId}/hold`,
      { method: "POST", body: JSON.stringify(payload) },
    ),
  getSpotHold: (holdId: string) =>
    request<{ hold: SpotHold }>(`/conductor/holds/${holdId}`),
  cancelSpotHold: (holdId: string) =>
    request<{ message: string }>(`/conductor/holds/${holdId}`, {
      method: "DELETE",
    }),
  paySpotHold: (holdId: string, paymentMethod: "cash" | "mercadopago") =>
    request<{
      reservation?: Reservation;
      payment?: PaymentOrderInfo;
      paymentMethod: string;
    }>(`/conductor/holds/${holdId}/pay`, {
      method: "POST",
      body: JSON.stringify({ paymentMethod }),
    }),

  getPaymentOrder: (orderId: string) =>
    request<{ order: PaymentOrderPublic; publicKey: string }>(
      `/payments/orders/${encodeURIComponent(orderId)}`,
    ),
  processPayment: (orderId: string, formData: Record<string, unknown>) =>
    request<{ status: string; paymentId?: string; order?: PaymentOrderInfo }>(
      "/payments/process",
      {
        method: "POST",
        body: JSON.stringify({ orderId, formData }),
      },
    ),
  reservations: (query?: ListQuery) =>
    request<PaginatedList<"reservations", Reservation>>(
      `/conductor/reservations${buildQuery(query)}`,
    ),
  cancelReservation: (id: string) =>
    request<{ reservation: Reservation }>(`/conductor/reservations/${id}`, {
      method: "DELETE",
    }),
  conductorPermits: (query?: ListQuery) =>
    request<PaginatedList<"permits", Permit>>(
      `/conductor/permits${buildQuery(query)}`,
    ),
  conductorPermitPayment: (id: string) =>
    request<{ payment: PaymentOrderInfo | null }>(
      `/conductor/permits/${id}/payment`,
    ),
  conductorConfig: () =>
    request<{
      maxAdvanceMinutes: number;
      holdPaymentMinutes: number;
      holdPaymentMinutesMp?: number;
    }>("/conductor/config"),
  conductorVehicles: (query?: ListQuery) =>
    request<PaginatedList<"vehicles", ConductorVehicle>>(
      `/conductor/vehicles${buildQuery(query)}`,
    ),
  conductorAddVehicle: (payload: Record<string, unknown>) =>
    request<{ vehicle: ConductorVehicle }>("/conductor/vehicles", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  conductorDeleteVehicle: (id: string) =>
    request<{ message: string }>(`/conductor/vehicles/${id}`, {
      method: "DELETE",
    }),
  conductorParkingAlerts: () =>
    request<{ alerts: ParkingAlert[] }>("/conductor/parking-alerts"),

  // Sessions (permisionario/admin)
  listSessions: (query?: ListQuery) =>
    request<PaginatedList<"sessions", Session>>(
      `/sessions${buildQuery(query)}`,
    ),
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

/** Plazas en vivo según rol (endpoint correcto por panel). */
export async function fetchLiveSpotsForRole(
  role: UserRole | undefined,
  opts?: { zone?: string },
): Promise<Spot[]> {
  if (!role) return [];
  if (role === "conductor") {
    return (await api.spotsLive(opts)).spots;
  }
  if (role === "admin") {
    let spots = (await api.adminSpotsLive()).spots;
    if (opts?.zone) {
      spots = spots.filter((s) => s.zone === opts.zone);
    }
    return spots;
  }
  if (role === "municipio") {
    let spots = (await api.municipioSpotsLive()).spots;
    if (opts?.zone) {
      spots = spots.filter((s) => s.zone === opts.zone);
    }
    return spots;
  }
  return (await api.permisionarioSpotsLive(opts)).spots;
}
