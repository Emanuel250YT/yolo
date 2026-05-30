import type { Spot } from "../types";

/** Valor del selector cuando se muestran todas las plazas de la zona. */
export const ALL_BLOCKS = "";

export function filterSpotsByBlock(
  spots: Spot[],
  blockId: string,
): Spot[] {
  if (!blockId) return spots;
  return spots.filter((s) => s.blockId === blockId);
}
