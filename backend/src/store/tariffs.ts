import { TARIFFS as DEFAULT_TARIFFS } from "../config/tariffs.js";
import { prisma } from "../lib/prisma.js";

export type TariffConfig = typeof DEFAULT_TARIFFS;

const KEY = "tariffs";

export async function getTariffs(): Promise<TariffConfig> {
  const row = await prisma.systemSetting.findUnique({ where: { key: KEY } });
  if (row?.value && typeof row.value === "object") {
    return { ...DEFAULT_TARIFFS, ...(row.value as Partial<TariffConfig>) };
  }
  return { ...DEFAULT_TARIFFS };
}

export async function updateTariffs(
  patch: Partial<TariffConfig>,
): Promise<TariffConfig> {
  const current = await getTariffs();
  const next: TariffConfig = { ...current, ...patch };
  await prisma.systemSetting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: next },
    update: { value: next },
  });
  return next;
}
