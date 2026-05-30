import type { TariffConfig } from "../store/tariffs.js";
import { TARIFFS } from "../config/tariffs.js";

export interface PricingInput {
  vehicleType?: "auto" | "motorcycle" | string;
  minutes?: number;
  digitalPayment?: boolean;
  tariffs?: TariffConfig;
  free?: boolean;
}

export function calculateAmount({
  vehicleType = "auto",
  minutes = 0,
  digitalPayment = false,
  tariffs = TARIFFS,
  free = false,
}: PricingInput) {
  if (free) {
    return finalize(0, false, tariffs);
  }
  const rate =
    vehicleType === "motorcycle"
      ? tariffs.motorcyclePerHour
      : tariffs.autoPerHour;

  if (minutes <= tariffs.toleranceMinutes) {
    return finalize(0, digitalPayment, tariffs);
  }

  let total = 0;
  let remaining = minutes;
  const firstHourMinutes = Math.min(60, remaining);
  total += rate;
  remaining -= firstHourMinutes;

  if (remaining > 0) {
    const fractionBlocks = Math.ceil(remaining / tariffs.fractionMinutes);
    const fractionRate = (rate / 60) * tariffs.fractionMinutes;
    total += fractionBlocks * fractionRate;
  }

  return finalize(Math.round(total), digitalPayment, tariffs);
}

function finalize(
  amount: number,
  digitalPayment: boolean,
  tariffs: TariffConfig,
) {
  const gross = amount;
  const discount =
    digitalPayment && gross > 0
      ? Math.round(gross * tariffs.digitalDiscountRate)
      : 0;
  return {
    gross,
    digitalDiscount: discount,
    net: gross - discount,
    digitalPayment,
    rules: {
      toleranceMinutes: tariffs.toleranceMinutes,
      digitalDiscountRate: tariffs.digitalDiscountRate,
      fractionMinutes: tariffs.fractionMinutes,
      fractionFromHour: tariffs.fractionFromHour,
    },
  };
}
