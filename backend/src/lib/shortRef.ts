import { prisma } from "./prisma.js";

const REF_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function randomRef(): string {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)];
  }
  return out;
}

type RefModel =
  | "user"
  | "permit"
  | "reservation"
  | "parkingSession"
  | "spot"
  | "parkingZone"
  | "parkingBlock"
  | "spotHold";

async function refTaken(model: RefModel, ref: string): Promise<boolean> {
  switch (model) {
    case "user":
      return Boolean(await prisma.user.findUnique({ where: { ref } }));
    case "permit":
      return Boolean(await prisma.permit.findUnique({ where: { ref } }));
    case "reservation":
      return Boolean(await prisma.reservation.findUnique({ where: { ref } }));
    case "parkingSession":
      return Boolean(await prisma.parkingSession.findUnique({ where: { ref } }));
    case "spot":
      return Boolean(await prisma.spot.findUnique({ where: { ref } }));
    case "parkingZone":
      return Boolean(await prisma.parkingZone.findUnique({ where: { ref } }));
    case "parkingBlock":
      return Boolean(await prisma.parkingBlock.findUnique({ where: { ref } }));
    case "spotHold":
      return Boolean(await prisma.spotHold.findUnique({ where: { ref } }));
    default:
      return true;
  }
}

export async function generateUniqueRef(model: RefModel): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const ref = randomRef();
    if (!(await refTaken(model, ref))) return ref;
  }
  throw new Error("No se pudo generar un ID único.");
}

export async function backfillMissingRefs() {
  const jobs: Promise<unknown>[] = [];

  const users = await prisma.user.findMany({ where: { ref: null }, select: { id: true } });
  for (const row of users) {
    jobs.push(
      prisma.user.update({
        where: { id: row.id },
        data: { ref: await generateUniqueRef("user") },
      }),
    );
  }

  const permits = await prisma.permit.findMany({ where: { ref: null }, select: { id: true } });
  for (const row of permits) {
    jobs.push(
      prisma.permit.update({
        where: { id: row.id },
        data: { ref: await generateUniqueRef("permit") },
      }),
    );
  }

  const reservations = await prisma.reservation.findMany({
    where: { ref: null },
    select: { id: true },
  });
  for (const row of reservations) {
    jobs.push(
      prisma.reservation.update({
        where: { id: row.id },
        data: { ref: await generateUniqueRef("reservation") },
      }),
    );
  }

  const sessions = await prisma.parkingSession.findMany({
    where: { ref: null },
    select: { id: true },
  });
  for (const row of sessions) {
    jobs.push(
      prisma.parkingSession.update({
        where: { id: row.id },
        data: { ref: await generateUniqueRef("parkingSession") },
      }),
    );
  }

  const spots = await prisma.spot.findMany({ where: { ref: null }, select: { id: true } });
  for (const row of spots) {
    jobs.push(
      prisma.spot.update({
        where: { id: row.id },
        data: { ref: await generateUniqueRef("spot") },
      }),
    );
  }

  const zones = await prisma.parkingZone.findMany({
    where: { ref: null },
    select: { id: true },
  });
  for (const row of zones) {
    jobs.push(
      prisma.parkingZone.update({
        where: { id: row.id },
        data: { ref: await generateUniqueRef("parkingZone") },
      }),
    );
  }

  const blocks = await prisma.parkingBlock.findMany({
    where: { ref: null },
    select: { id: true },
  });
  for (const row of blocks) {
    jobs.push(
      prisma.parkingBlock.update({
        where: { id: row.id },
        data: { ref: await generateUniqueRef("parkingBlock") },
      }),
    );
  }

  const holds = await prisma.spotHold.findMany({ where: { ref: null }, select: { id: true } });
  for (const row of holds) {
    jobs.push(
      prisma.spotHold.update({
        where: { id: row.id },
        data: { ref: await generateUniqueRef("spotHold") },
      }),
    );
  }

  await Promise.all(jobs);
}
