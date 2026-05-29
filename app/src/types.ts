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

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  legajo: string | null;
  zone: string | null;
  active: boolean;
  activationPending?: boolean;
  citizen?: CitizenProfile | null;
  createdByMunicipio?: boolean;
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
}

export interface RegisterPayload {
  role: RegisterRole;
  email: string;
  password: string;
  name?: string;
  legajo?: string;
  zone?: string;
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

export interface Permit {
  id: string;
  permisionarioId: string;
  permisionarioName: string;
  permisionarioLegajo: string | null;
  plate: string;
  zone: string;
  vehicleType: "auto" | "motorcycle";
  notes: string | null;
  status: string;
  startAt: string;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEntry {
  id: string;
  permitId: string;
  userId: string;
  userName: string;
  action: "create" | "update" | "observation";
  before?: unknown;
  after?: unknown;
  observation: string | null;
  createdAt: string;
}

export interface Spot {
  id: string;
  label: string;
  zone: string;
  address: string;
  capacity: number;
  occupied: number;
  enabled: boolean;
}

export interface Reservation {
  id: string;
  userId: string;
  userName: string;
  spotId: string;
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

export interface AdminOverview {
  users: number;
  permits: number;
  spots: number;
  reservations: number;
  sessions: number;
  history: number;
}
