/** Reserva temporal mientras el conductor elige método de pago (efectivo). */
export const SPOT_HOLD_MS = 10 * 60 * 1000;

/** Tolerancia para completar pago con Mercado Pago en pre-reserva. */
export const SPOT_HOLD_MP_MS = 5 * 60 * 1000;

export function spotHoldMs(digitalPayment: boolean) {
  return digitalPayment ? SPOT_HOLD_MP_MS : SPOT_HOLD_MS;
}
