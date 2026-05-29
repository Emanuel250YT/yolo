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

export interface SessionsResponse {
  sessions: Session[];
}

export type TabId = "inicio" | "estacionar" | "cotizar" | "activas";
