import { TARIFFS } from "../config/tariffs.js";

export interface PricingInput {
  vehicleType?: "auto" | "motorcycle" | string;
  minutes?: number;
  digitalPayment?: boolean;
}

export function calculateAmount({
  vehicleType = "auto",
  minutes = 0,
  digitalPayment = false,
}: PricingInput) {
  const rate =
    vehicleType === "motorcycle"
      ? TARIFFS.motorcyclePerHour
      : TARIFFS.autoPerHour;

  if (minutes <= TARIFFS.toleranceMinutes) {
    return finalize(0, digitalPayment);
  }

  let total = 0;
  let remaining = minutes;
  const firstHourMinutes = Math.min(60, remaining);
  total += rate;
  remaining -= firstHourMinutes;

  if (remaining > 0) {
    const fractionBlocks = Math.ceil(remaining / TARIFFS.fractionMinutes);
    const fractionRate = (rate / 60) * TARIFFS.fractionMinutes;
    total += fractionBlocks * fractionRate;
  }

  return finalize(Math.round(total), digitalPayment);
}

function finalize(amount: number, digitalPayment: boolean) {
  const gross = amount;
  const discount =
    digitalPayment && gross > 0
      ? Math.round(gross * TARIFFS.digitalDiscountRate)
      : 0;
  return {
    gross,
    digitalDiscount: discount,
    net: gross - discount,
    digitalPayment,
    rules: {
      toleranceMinutes: TARIFFS.toleranceMinutes,
      digitalDiscountRate: TARIFFS.digitalDiscountRate,
      fractionMinutes: TARIFFS.fractionMinutes,
      fractionFromHour: TARIFFS.fractionFromHour,
    },
  };
}
