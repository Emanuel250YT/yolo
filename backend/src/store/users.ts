import bcrypt from "bcryptjs";
import type { Prisma, Sex, User, UserRole } from "../prisma/client.js";
import { ROLES } from "../config/auth.js";

const VALID_ROLES = new Set<string>(ROLES);
import {
  paginatedResult,
  parsePaginationQuery,
  type PaginatedResult,
  type PaginationParams,
} from "../lib/pagination.js";
import { prisma } from "../lib/prisma.js";
import { generateUniqueRef } from "../lib/shortRef.js";
import type { CitizenDto, SafeUser } from "../types/api.js";
import { resolveParkingZoneAssignment } from "./zoneAssignment.js";
import { syncUserParkingZones } from "./userZones.js";

export type { SafeUser };

type UserWithRelations = User & {
  citizen: Prisma.CitizenProfileGetPayload<object> | null;
  parkingZone: { id: string; code: string; name: string } | null;
  assignedZones?: {
    parkingZoneId: string;
    parkingZone: { id: string; code: string; name: string };
  }[];
};

const userInclude = {
  citizen: true,
  parkingZone: { select: { id: true, code: true, name: true } },
  assignedZones: {
    include: { parkingZone: { select: { id: true, code: true, name: true } } },
    orderBy: { assignedAt: "asc" as const },
  },
} as const;

export function sanitizeUser(user: UserWithRelations): SafeUser {
  const assignedFromJoin =
    user.assignedZones?.map((a) => ({
      id: a.parkingZone.id,
      code: a.parkingZone.code,
      name: a.parkingZone.name,
    })) ?? [];

  const parkingZoneIds =
    assignedFromJoin.length > 0
      ? assignedFromJoin.map((z) => z.id)
      : user.parkingZoneId
        ? [user.parkingZoneId]
        : [];

  const base: SafeUser = {
    id: user.id,
    ref: user.ref,
    email: user.email,
    name: user.name,
    role: user.role,
    legajo: user.legajo,
    zone: user.zone,
    parkingZoneId: user.parkingZoneId,
    parkingZoneIds,
    assignedZones: assignedFromJoin,
    zoneName:
      assignedFromJoin.map((z) => z.name).join(", ") ||
      user.parkingZone?.name ||
      null,
    active: user.active,
    activationPending: user.activationPending,
  createdByMunicipio: user.createdByMunicipio,
  mercadoPagoLinked: Boolean(
    user.mercadoPagoUserId || user.mercadoPagoAccessToken,
  ),
  mercadoPagoLinkedAt: user.mercadoPagoLinkedAt?.toISOString() ?? null,
  createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
  if (user.citizen) {
    base.citizen = {
      dni: user.citizen.dni,
      birthDate: user.citizen.birthDate.toISOString().slice(0, 10),
      sex: user.citizen.sex,
      firstName: user.citizen.firstName,
      lastName: user.citizen.lastName,
      phone: user.citizen.phone,
      address: user.citizen.address,
      city: user.citizen.city,
      province: user.citizen.province,
      nationality: user.citizen.nationality,
      plate: user.citizen.plate,
    };
  }
  return base;
}

function userSearchWhere(q?: string): Prisma.UserWhereInput | undefined {
  if (!q) return undefined;
  return {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { legajo: { contains: q, mode: "insensitive" } },
      { ref: { contains: q, mode: "insensitive" } },
      { zone: { contains: q, mode: "insensitive" } },
    ],
  };
}

export async function findByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: userInclude,
  });
}

export async function findByDni(dni: string) {
  const profile = await prisma.citizenProfile.findUnique({
    where: { dni: dni.trim() },
    include: { user: { include: userInclude } },
  });
  return profile?.user ?? null;
}

export async function findById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: userInclude,
  });
}

export async function listUsers(opts: {
  role?: UserRole;
  activationPending?: boolean;
  active?: boolean;
  excludeRole?: UserRole;
  pagination?: PaginationParams;
} = {}): Promise<PaginatedResult<SafeUser> | SafeUser[]> {
  const where: Prisma.UserWhereInput = {
    ...(opts.role ? { role: opts.role } : {}),
    ...(opts.excludeRole ? { role: { not: opts.excludeRole } } : {}),
    ...(opts.activationPending === true ? { activationPending: true } : {}),
    ...(opts.active === true ? { active: true } : {}),
    ...(opts.active === false ? { active: false } : {}),
    ...(opts.pagination?.q ? userSearchWhere(opts.pagination.q) : {}),
  };

  if (!opts.pagination) {
    const users = await prisma.user.findMany({
      where,
      include: userInclude,
      orderBy: { createdAt: "desc" },
    });
    return users.map(sanitizeUser);
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: userInclude,
      orderBy: { createdAt: "desc" },
      skip: opts.pagination.skip,
      take: opts.pagination.take,
    }),
  ]);

  return paginatedResult(
    users.map(sanitizeUser),
    total,
    opts.pagination,
  );
}

export interface CitizenInput {
  dni: string;
  birthDate: string;
  sex: "F" | "M" | "X";
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  city: string;
  province?: string;
  nationality?: string;
  plate?: string | null;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
  role: UserRole;
  legajo?: string | null;
  zone?: string | null;
  parkingZoneId?: string | null;
  parkingZoneIds?: string[];
  active?: boolean;
  activationPending?: boolean;
  citizen?: CitizenInput | null;
  createdByMunicipio?: boolean;
}

export async function createUser(input: CreateUserInput): Promise<SafeUser> {
  if (!VALID_ROLES.has(input.role)) {
    throw new Error("Rol inválido.");
  }

  const normalized = input.email.toLowerCase().trim();
  if (await findByEmail(normalized)) {
    throw new Error("El correo ya está registrado.");
  }
  if (!input.password || input.password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  if (input.role === "permisionario" && !input.legajo?.trim()) {
    throw new Error("El legajo es obligatorio para permisionarios.");
  }
  if (!input.citizen) {
    throw new Error("Los datos personales son obligatorios.");
  }

  let parkingZoneId: string | null = null;
  let zone: string | null = input.zone?.trim() || null;
  const zoneIds =
    input.parkingZoneIds ??
    (input.parkingZoneId ? [input.parkingZoneId] : []);

  if (input.role === "permisionario" && zoneIds.length === 1 && !input.parkingZoneIds) {
    const assign = await resolveParkingZoneAssignment({
      parkingZoneId: zoneIds[0],
      zone: input.zone,
      required: false,
    });
    parkingZoneId = assign.parkingZoneId;
    zone = assign.zone;
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  const user = await prisma.user.create({
    data: {
      ref: await generateUniqueRef("user"),
      email: normalized,
      passwordHash,
      name: input.name?.trim() || normalized.split("@")[0],
      role: input.role,
      legajo: input.legajo?.trim() || null,
      zone,
      parkingZoneId,
      active: Boolean(input.active ?? true),
      activationPending: Boolean(input.activationPending ?? false),
      createdByMunicipio: Boolean(input.createdByMunicipio ?? false),
      ...(input.citizen
        ? {
            citizen: {
              create: {
                dni: input.citizen.dni.trim(),
                birthDate: new Date(input.citizen.birthDate),
                sex: input.citizen.sex as Sex,
                firstName: input.citizen.firstName.trim(),
                lastName: input.citizen.lastName.trim(),
                phone: input.citizen.phone.trim(),
                address: input.citizen.address.trim(),
                city: input.citizen.city.trim(),
                province: input.citizen.province?.trim() || "Salta",
                nationality: input.citizen.nationality?.trim() || "Argentina",
                plate: input.citizen.plate?.trim().toUpperCase() || null,
              },
            },
          }
        : {}),
    },
    include: userInclude,
  });

  if (input.role === "permisionario") {
    if (input.parkingZoneIds !== undefined) {
      await syncUserParkingZones(user.id, input.parkingZoneIds);
    } else if (zoneIds.length) {
      await syncUserParkingZones(user.id, zoneIds);
    }
    const refreshed = await findById(user.id);
    return sanitizeUser(refreshed!);
  }

  return sanitizeUser(user);
}

export async function verifyPassword(user: User, password: string) {
  return bcrypt.compare(password, user.passwordHash);
}

export async function updateUser(
  id: string,
  patch: Partial<{
    email: string;
    name: string;
    legajo: string | null;
    zone: string | null;
    parkingZoneId: string | null;
    parkingZoneIds: string[];
    active: boolean;
    activationPending: boolean;
    role: UserRole;
  }>,
): Promise<SafeUser | null> {
  const existing = await findById(id);
  if (!existing) return null;

  if (existing.role === "municipio" && patch.active === false) {
    throw new Error("La cuenta Municipio no puede desactivarse.");
  }

  if (patch.email && patch.email !== existing.email) {
    const dup = await findByEmail(patch.email);
    if (dup && dup.id !== id) {
      throw new Error("El correo ya está en uso.");
    }
  }

  const role = patch.role ?? existing.role;
  const data: Prisma.UserUpdateInput = {};
  if (patch.email) data.email = patch.email.toLowerCase().trim();
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.legajo !== undefined) data.legajo = patch.legajo?.trim() || null;
  if (patch.active !== undefined) {
    data.active = patch.active;
    if (patch.active) data.activationPending = false;
  }
  if (patch.activationPending !== undefined) {
    data.activationPending = patch.activationPending;
  }
  if (patch.role !== undefined) {
    if (!VALID_ROLES.has(patch.role) || patch.role === "municipio") {
      throw new Error("Rol inválido.");
    }
    data.role = patch.role;
  }

  if (role === "permisionario" && patch.parkingZoneIds !== undefined) {
    await syncUserParkingZones(id, patch.parkingZoneIds);
  } else if (
    role === "permisionario" &&
    (patch.parkingZoneId !== undefined || patch.zone !== undefined)
  ) {
    const assign = await resolveParkingZoneAssignment({
      parkingZoneId: patch.parkingZoneId ?? existing.parkingZoneId,
      zone: patch.zone ?? existing.zone,
      required: false,
    });
    if (assign.parkingZoneId) {
      data.parkingZone = { connect: { id: assign.parkingZoneId } };
      await syncUserParkingZones(id, [assign.parkingZoneId]);
    } else {
      data.parkingZone = { disconnect: true };
      await syncUserParkingZones(id, []);
    }
    data.zone = assign.zone;
  } else if (patch.zone !== undefined && role !== "permisionario") {
    data.zone = patch.zone?.trim() || null;
    if (!patch.zone) data.parkingZone = { disconnect: true };
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    include: userInclude,
  });

  return sanitizeUser(user);
}

export async function setPassword(id: string, password: string) {
  if (!password || password.length < 6) {
    throw new Error("La contraseña debe tener al menos 6 caracteres.");
  }
  const user = await prisma.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
    include: userInclude,
  });
  return sanitizeUser(user);
}

export { parsePaginationQuery };
