/** Tarifas y reglas operativas SEM — Ordenanza 12.170 (valores configurables). */

export const TARIFFS = {
  autoPerHour: 700,
  motorcyclePerHour: 300,
  toleranceMinutes: 5,
  digitalDiscountRate: 0.2,
  fractionMinutes: 15,
  fractionFromHour: 2,
};

export const SHIFTS = {
  day: {
    id: "day",
    label: "Diurno",
    weekday: { start: "07:00", end: "21:00" },
    saturday: { start: "07:00", end: "14:00" },
    chargeOnHolidays: false,
  },
  night: {
    id: "night",
    label: "Nocturno",
    daily: { start: "22:00", end: "05:00" },
    zones: [
      "locales-diversión",
      "paseo-balcarce",
      "paseo-guemes",
      "plaza-alvarado",
    ],
  },
};
