export type UserRole = "municipio" | "admin" | "permisionario" | "conductor";
export type RegisterRole = "conductor" | "permisionario" | "admin";

export interface CitizenProfile {
  dni: string;
  birthDate: string;
  sex: "F" | "M" | "X";
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  nationality: string;
  plate: string | null;
}

export interface PaginatedMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> extends PaginatedMeta {
  items: T[];
}

export interface User {
  id: string;
  ref?: string | null;
  email: string;
  name: string;
  role: UserRole;
  legajo: string | null;
  zone: string | null;
  parkingZoneId: string | null;
  parkingZoneIds?: string[];
  assignedZones?: { id: string; code: string; name: string }[];
  zoneName: string | null;
  active: boolean;
  activationPending?: boolean;
  citizen?: CitizenProfile | null;
  createdByMunicipio?: boolean;
  mercadoPagoLinked?: boolean;
  mercadoPagoLinkedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  message?: string;
}

export interface RegistrationConfig {
  conductorRegistrationEnabled: boolean;
  staffRegistrationEnabled: boolean;
  staffRolesRequireActivation: string[];
  message: string;
  devTools?: boolean;
  version?: string;
  commit?: string;
}

export interface RegisterPayload {
  role: RegisterRole;
  email: string;
  password: string;
  name?: string;
  legajo?: string;
  zone?: string;
  parkingZoneId?: string;
  parkingZoneIds?: string[];
  citizen?: Partial<CitizenProfile>;
}

export interface HealthResponse {
  status: string;
  service: string;
  version?: string;
}

export interface Tariffs {
  autoPerHour: number;
  motorcyclePerHour: number;
  toleranceMinutes: number;
  digitalDiscountRate: number;
  fractionMinutes: number;
  fractionFromHour: number;
}

export interface TariffsResponse {
  tariffs: Tariffs;
  shifts: Record<string, unknown>;
}

export interface ShiftStatus {
  canChargeDay: boolean;
  canChargeNight: boolean;
  canCharge: boolean;
  activeShift: string | null;
  message: string;
  zones: string[];
  now: string;
  simulatedClock?: boolean;
}

export interface QuotePayload {
  plate?: string;
  vehicleType: "auto" | "motorcycle";
  minutes: number;
  digitalPayment: boolean;
}

export interface PricingBreakdown {
  gross: number;
  digitalDiscount: number;
  net: number;
  digitalPayment: boolean;
  rules: {
    toleranceMinutes: number;
    digitalDiscountRate: number;
    fractionMinutes: number;
    fractionFromHour: number;
  };
}

export interface QuoteResult extends PricingBreakdown {
  plate: string | null;
  vehicleType: "auto" | "motorcycle";
  minutes: number;
}

export interface Session {
  id: string;
  ref?: string | null;
  plate: string;
  vehicleType: "auto" | "motorcycle";
  zone: string;
  digitalPayment: boolean;
  permitId: string | null;
  status: "active" | "completed";
  startedAt: string;
  endedAt: string | null;
  checkout: (PricingBreakdown & { minutes: number }) | null;
}

export interface ParkingAlert {
  permitId: string;
  plate: string;
  zone: string;
  endAt: string;
  minutesRemaining: number;
  durationMinutes: number;
  pricing?: PricingBreakdown | null;
}

export interface ConductorVehicle {
  id: string;
  userId: string;
  plate: string;
  vehicleType: "auto" | "motorcycle";
  label: string | null;
  source: "manual" | "gov" | string;
  createdAt: string;
}

export interface Permit {
  id: string;
  ref?: string | null;
  permisionarioId: string;
  permisionarioRef?: string | null;
  permisionarioName: string;
  permisionarioLegajo: string | null;
  plate: string;
  zone: string;
  vehicleType: "auto" | "motorcycle";
  notes: string | null;
  durationMinutes?: number;
  pricing?: PricingBreakdown | null;
  paymentMethod?: "cash" | "mercadopago" | null;
  paidAt?: string | null;
  spotId?: string | null;
  spotLabel?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  status: string;
  graceUntil?: string | null;
  startAt: string;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentOrderInfo {
  orderId: string;
  preferenceId: string;
  amount: number;
  currencyId: string;
  status: string;
  title: string;
  description?: string | null;
  paymentUrl: string;
  initPoint?: string | null;
}

export interface PaymentOrderPublic {
  orderId: string;
  amount: number;
  currencyId: string;
  preferenceId: string;
  status: string;
  title: string;
  description?: string | null;
  paymentUrl: string;
  initPoint?: string | null;
  paidAt?: string | null;
}

export interface HistoryEntry {
  id: string;
  permitId: string | null;
  entityType?: string | null;
  entityId?: string | null;
  entityRef?: string | null;
  entityLabel?: string | null;
  userId: string;
  userName: string;
  action:
    | "create"
    | "update"
    | "delete"
    | "observation"
    | "activate"
    | "deactivate";
  before?: unknown;
  after?: unknown;
  observation: string | null;
  createdAt: string;
}

export type SpotType = "pago" | "gratuita";

export interface Spot {
  id: string;
  ref?: string | null;
  label: string;
  zone: string;
  region?: string | null;
  parkingZoneId?: string | null;
  blockId?: string | null;
  blockName?: string | null;
  blockStreet?: string | null;
  blockCode?: string | null;
  row?: number;
  col?: number;
  address: string;
  lat?: number | null;
  lng?: number | null;
  capacity: number;
  occupied: number;
  spotType: SpotType;
  enabled: boolean;
  status?: "available" | "held" | "occupied" | "disabled";
  holdId?: string | null;
  holdExpiresAt?: string | null;
  heldByMe?: boolean;
}

export interface ParkingBlock {
  id: string;
  ref?: string | null;
  zoneId: string;
  zoneCode?: string;
  zoneName?: string;
  region?: string;
  code: string;
  name: string;
  street: string;
  lat: number | null;
  lng: number | null;
  enabled: boolean;
  distanceM?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SpotHold {
  id: string;
  ref?: string | null;
  spotId: string;
  plate: string;
  vehicleType?: "auto" | "motorcycle";
  scheduledStart?: string;
  durationMinutes: number;
  digitalPayment?: boolean;
  pricing: PricingBreakdown;
  expiresAt: string;
  createdAt?: string;
}

export interface Reservation {
  id: string;
  ref?: string | null;
  userId: string;
  userRef?: string | null;
  userName: string;
  spotId: string;
  spotRef?: string | null;
  spotLabel: string;
  zone: string;
  plate: string;
  vehicleType: "auto" | "motorcycle";
  scheduledStart: string;
  durationMinutes: number;
  digitalPayment: boolean;
  pricing: PricingBreakdown;
  status: string;
  createdAt: string;
}

export interface ParkingPolygon {
  points: [number, number][];
}

export interface ParkingZone {
  id: string;
  ref?: string | null;
  code: string;
  name: string;
  region: string;
  description: string;
  imageMimeType: string | null;
  hasImage: boolean;
  imageBase64?: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  polygons: ParkingPolygon[];
  slotCount: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminOverview {
  users: number;
  permits: number;
  spots: number;
  reservations: number;
  sessions: number;
  history: number;
  parkingZones?: number;
}

export interface DashboardStats {
  overview: AdminOverview;
  usersByRole: Record<string, number>;
  usersPending: number;
  permitsByStatus: Record<string, number>;
  reservationsByStatus: Record<string, number>;
  sessionsActive: number;
  sessionsCompleted: number;
  spotsByStatus: {
    available: number;
    occupied: number;
    held: number;
    disabled: number;
    total: number;
  };
  revenueToday: {
    permits: number;
    sessions: number;
    total: number;
  };
  revenueLast7Days: { date: string; amount: number }[];
  permitsLast7Days: { date: string; count: number }[];
  zoneOccupancy: {
    zone: string;
    zoneName: string;
    total: number;
    occupied: number;
    held: number;
    available: number;
    occupancyPct: number;
  }[];
  recentPermits: {
    id: string;
    ref: string | null;
    plate: string;
    zone: string;
    status: string;
    net: number | null;
    createdAt: string;
  }[];
  recentReservations: {
    id: string;
    ref: string | null;
    plate: string;
    spotLabel: string;
    status: string;
    net: number | null;
    scheduledStart: string;
  }[];
  generatedAt: string;
}
