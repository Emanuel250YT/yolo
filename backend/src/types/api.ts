import type { UserRole, VehicleType } from "../prisma/client.js";

export type { UserRole, VehicleType };

export interface SafeUser {
  id: string;
  ref: string | null;
  email: string;
  name: string;
  role: UserRole;
  legajo: string | null;
  zone: string | null;
  parkingZoneId: string | null;
  zoneName: string | null;
  active: boolean;
  activationPending: boolean;
  createdByMunicipio: boolean;
  createdAt: string;
  updatedAt: string;
  citizen?: CitizenDto | null;
}

export interface CitizenDto {
  dni: string;
  birthDate: string;
  sex: string;
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  nationality: string;
  plate: string | null;
}

export interface AuthActor {
  id: string;
  name: string;
  role: UserRole;
  legajo?: string | null;
  zone?: string | null;
}
