import type { UserRole } from "../prisma/client.js";
import { PUBLIC_REGISTER_ROLES, STAFF_ROLES } from "../config/auth.js";
import {
  createUser,
  findByDni,
  type CreateUserInput,
} from "../store/users.js";

const SEX_OPTIONS = ["F", "M", "X"] as const;

function validateCitizenProfile(profile: CreateUserInput["citizen"]) {
  if (!profile?.dni?.trim()) throw new Error("El DNI es obligatorio.");
  if (!/^\d{7,8}$/.test(profile.dni.trim())) {
    throw new Error("El DNI debe tener 7 u 8 dígitos numéricos.");
  }
  if (!profile.birthDate) {
    throw new Error("La fecha de nacimiento es obligatoria.");
  }
  const birth = new Date(profile.birthDate);
  if (Number.isNaN(birth.getTime())) {
    throw new Error("Fecha de nacimiento inválida.");
  }
  const age =
    (Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (age < 16) {
    throw new Error("Debés ser mayor de 16 años para registrarte.");
  }
  if (!profile.sex || !SEX_OPTIONS.includes(profile.sex)) {
    throw new Error("Seleccioná un sexo válido (F, M o X).");
  }
  if (!profile.firstName?.trim() || !profile.lastName?.trim()) {
    throw new Error("Nombre y apellido son obligatorios.");
  }
  if (!profile.phone?.trim()) throw new Error("El teléfono es obligatorio.");
  if (!profile.address?.trim()) throw new Error("El domicilio es obligatorio.");
  if (!profile.city?.trim()) throw new Error("La localidad es obligatoria.");
}

export function getRegistrationConfig() {
  return {
    conductorRegistrationEnabled: true,
    staffRegistrationEnabled: true,
    staffRolesRequireActivation: STAFF_ROLES,
    message:
      "Podés registrarte como permisionario o administrador. Tu cuenta quedará inactiva hasta que la Municipalidad complete el alta.",
  };
}

export async function registerPublicUser(body: Record<string, unknown>) {
  const role = body.role as string;
  const email = body.email as string;
  const password = body.password as string;

  if (!PUBLIC_REGISTER_ROLES.includes(role as (typeof PUBLIC_REGISTER_ROLES)[number])) {
    throw new Error("Tipo de cuenta no válido.");
  }

  if (role === "conductor") {
    const citizen = body.citizen as CreateUserInput["citizen"];
    validateCitizenProfile(citizen);
    if (citizen && (await findByDni(citizen.dni))) {
      throw new Error("Ya existe una cuenta con ese DNI.");
    }
    const user = await createUser({
      email,
      password,
      name: `${citizen!.firstName.trim()} ${citizen!.lastName.trim()}`,
      role: "conductor",
      active: true,
      citizen: citizen!,
    });
    return {
      user,
      autoLogin: true,
      message: "Cuenta de conductor creada correctamente.",
    };
  }

  const user = await createUser({
    email,
    password,
    name: body.name as string,
    role: role as UserRole,
    legajo: body.legajo as string | undefined,
    zone: body.zone as string | undefined,
    parkingZoneId: body.parkingZoneId as string | undefined,
    active: false,
    activationPending: true,
  });

  return {
    user,
    autoLogin: false,
    message:
      "Cuenta creada correctamente. Permanece inactiva hasta que la Municipalidad te habilite. Al iniciar sesión verás el estado de tu alta.",
  };
}

export async function registerStaffByMunicipio(
  body: Record<string, unknown>,
) {
  const role = body.role as string;
  if (!STAFF_ROLES.includes(role as (typeof STAFF_ROLES)[number])) {
    throw new Error("Solo podés crear permisionarios o administradores.");
  }

  const user = await createUser({
    email: body.email as string,
    password: body.password as string,
    name: body.name as string,
    role: role as UserRole,
    legajo: body.legajo as string | undefined,
    zone: body.zone as string | undefined,
    parkingZoneId: body.parkingZoneId as string | undefined,
    active: body.active !== false,
    activationPending: false,
    createdByMunicipio: true,
    citizen: body.citizen as CreateUserInput["citizen"],
  });

  return { user };
}
