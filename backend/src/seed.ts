import { backfillMissingRefs } from "./lib/shortRef.js";
import { prisma } from "./lib/prisma.js";
import { MUNICIPIO_EMAIL, MUNICIPIO_PASSWORD } from "./config/auth.js";
import {
  linkUsersToParkingZones,
  migrateZonePolygonsIfEmpty,
  seedParkingZonesIfEmpty,
} from "./store/parkingZones.js";
import { migrateLegacySpotsToBlocks, seedSpotsIfEmpty } from "./store/spots.js";
import { createUser, findByEmail } from "./store/users.js";

interface DevSeedAccount {
  email: string;
  password: string;
  name: string;
  role: "municipio" | "admin" | "permisionario" | "conductor";
  legajo?: string;
}

function parseDevSeedAccounts(): DevSeedAccount[] {
  const raw = process.env.DEV_SEED_ACCOUNTS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DevSeedAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const DEFAULT_DEV_ACCOUNTS: DevSeedAccount[] = [
  {
    email: "municipio@ejemplo.com",
    password: "tu-clave",
    name: "Municipalidad Demo",
    role: "municipio",
  },
  {
    email: "admin@ejemplo.com",
    password: "tu-clave",
    name: "Admin Demo",
    role: "admin",
  },
  {
    email: "perm@ejemplo.com",
    password: "tu-clave",
    name: "Permisionario Demo",
    role: "permisionario",
    legajo: "P-001",
  },
  {
    email: "conductor@ejemplo.com",
    password: "tu-clave",
    name: "Conductor Demo",
    role: "conductor",
  },
];

const DEV_CITIZEN = {
  birthDate: "1990-01-01",
  sex: "X" as const,
  phone: "3875000000",
  address: "Salta",
  city: "Salta",
  province: "Salta",
  nationality: "Argentina",
};

async function seedDevAccounts() {
  if (process.env.ENABLE_DEV_TOOLS !== "true") return;

  const accounts =
    parseDevSeedAccounts().length > 0
      ? parseDevSeedAccounts()
      : DEFAULT_DEV_ACCOUNTS;

  const firstZone = await prisma.parkingZone.findFirst({
    where: { enabled: true },
    orderBy: { name: "asc" },
  });

  for (const acc of accounts) {
    if (await findByEmail(acc.email)) continue;

    if (acc.role === "permisionario" && !firstZone) {
      console.warn(
        `[SEM] Omitiendo ${acc.email}: no hay zonas habilitadas. Creá una zona y volvé a ejecutar npm run seed.`,
      );
      continue;
    }

    await createUser({
      email: acc.email,
      password: acc.password,
      name: acc.name,
      role: acc.role,
      legajo: acc.legajo,
      parkingZoneId:
        acc.role === "permisionario" ? firstZone!.id : undefined,
      active: true,
      activationPending: false,
      citizen: {
        dni: `DEV-${acc.role.slice(0, 3).toUpperCase()}-${acc.email.slice(0, 3)}`,
        birthDate: DEV_CITIZEN.birthDate,
        sex: DEV_CITIZEN.sex,
        firstName: acc.name.split(" ")[0] ?? acc.name,
        lastName: acc.name.split(" ").slice(1).join(" ") || "Demo",
        phone: DEV_CITIZEN.phone,
        address: DEV_CITIZEN.address,
        city: DEV_CITIZEN.city,
        province: DEV_CITIZEN.province,
        nationality: DEV_CITIZEN.nationality,
      },
    });
    console.log(`[SEM] Cuenta dev creada: ${acc.email}`);
  }
}

export async function runSeed() {
  await seedParkingZonesIfEmpty();
  await migrateZonePolygonsIfEmpty();
  await linkUsersToParkingZones();
  await migrateLegacySpotsToBlocks();
  await seedSpotsIfEmpty();
  await backfillMissingRefs();

  if (!MUNICIPIO_EMAIL || !MUNICIPIO_PASSWORD) {
    console.warn(
      "[SEM] Definí MUNICIPIO_EMAIL y MUNICIPIO_PASSWORD en .env para la cuenta Municipalidad.",
    );
  } else if (!(await findByEmail(MUNICIPIO_EMAIL))) {
    await createUser({
      email: MUNICIPIO_EMAIL,
      password: MUNICIPIO_PASSWORD,
      name: "Municipalidad de Salta",
      role: "municipio",
      active: true,
      activationPending: false,
      citizen: {
        dni: "MUNICIPIO-001",
        birthDate: "2000-01-01",
        sex: "X",
        firstName: "Municipalidad",
        lastName: "de Salta",
        phone: "3874000000",
        address: "Salta",
        city: "Salta",
        province: "Salta",
        nationality: "Argentina",
      },
    });
    console.log(`Cuenta Municipio lista: ${MUNICIPIO_EMAIL}`);
  }

  await seedDevAccounts();
}
