import { MUNICIPIO_EMAIL } from "../config/auth.js";
import { ensureMunicipioAccount } from "../services/municipioAccount.js";
import { prisma } from "../lib/prisma.js";

export interface DbCleanResult {
  spotHolds: number;
  reservations: number;
  sessions: number;
  history: number;
  permits: number;
  spots: number;
  blocks: number;
  zones: number;
  users: number;
  systemSettings: number;
  municipioPreserved: boolean;
  municipioEmail: string | null;
}

/**
 * Vacía la base operativa. La cuenta Municipalidad (.env) no se elimina y se
 * re-sincroniza al finalizar con MUNICIPIO_EMAIL / MUNICIPIO_PASSWORD.
 */
export async function cleanDatabase(): Promise<DbCleanResult> {
  const municipioEmail = MUNICIPIO_EMAIL ?? null;

  const result = await prisma.$transaction(async (tx) => {
    const spotHolds = (await tx.spotHold.deleteMany()).count;
    const reservations = (await tx.reservation.deleteMany()).count;
    const sessions = (await tx.parkingSession.deleteMany()).count;
    const history = (await tx.historyEntry.deleteMany()).count;
    const permits = (await tx.permit.deleteMany()).count;
    const spots = (await tx.spot.deleteMany()).count;
    const blocks = (await tx.parkingBlock.deleteMany()).count;

    if (municipioEmail) {
      await tx.user.updateMany({
        where: { email: municipioEmail },
        data: { parkingZoneId: null, zone: null },
      });
    }

    const zones = (await tx.parkingZone.deleteMany()).count;

    const users = municipioEmail
      ? (
          await tx.user.deleteMany({
            where: { email: { not: municipioEmail } },
          })
        ).count
      : (await tx.user.deleteMany()).count;

    const systemSettings = (await tx.systemSetting.deleteMany()).count;

    return {
      spotHolds,
      reservations,
      sessions,
      history,
      permits,
      spots,
      blocks,
      zones,
      users,
      systemSettings,
      municipioPreserved: Boolean(municipioEmail),
      municipioEmail,
    };
  });

  await ensureMunicipioAccount();

  return result;
}

/** @deprecated Usar cleanDatabase */
export const cleanOperationalData = cleanDatabase;
