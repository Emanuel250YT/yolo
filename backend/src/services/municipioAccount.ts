import { MUNICIPIO_EMAIL, MUNICIPIO_PASSWORD } from "../config/auth.js";
import { prisma } from "../lib/prisma.js";
import { createUser, findByEmail, setPassword } from "../store/users.js";

const MUNICIPIO_CITIZEN = {
  dni: "MUNICIPIO-001",
  birthDate: "2000-01-01",
  sex: "X" as const,
  firstName: "Municipalidad",
  lastName: "de Salta",
  phone: "3874000000",
  address: "Salta",
  city: "Salta",
  province: "Salta",
  nationality: "Argentina",
};

export interface EnsureMunicipioResult {
  ok: boolean;
  created: boolean;
  email?: string;
  error?: string;
}

/** Garantiza la cuenta Municipalidad según MUNICIPIO_EMAIL / MUNICIPIO_PASSWORD del .env */
export async function ensureMunicipioAccount(): Promise<EnsureMunicipioResult> {
  if (!MUNICIPIO_EMAIL || !MUNICIPIO_PASSWORD) {
    return {
      ok: false,
      created: false,
      error: "Definí MUNICIPIO_EMAIL y MUNICIPIO_PASSWORD en .env",
    };
  }

  const existing = await findByEmail(MUNICIPIO_EMAIL);
  if (existing) {
    await setPassword(existing.id, MUNICIPIO_PASSWORD);
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        active: true,
        activationPending: false,
        parkingZoneId: null,
        zone: null,
      },
    });
    return { ok: true, created: false, email: MUNICIPIO_EMAIL };
  }

  await createUser({
    email: MUNICIPIO_EMAIL,
    password: MUNICIPIO_PASSWORD,
    name: "Municipalidad de Salta",
    role: "municipio",
    active: true,
    activationPending: false,
    citizen: MUNICIPIO_CITIZEN,
  });

  return { ok: true, created: true, email: MUNICIPIO_EMAIL };
}
