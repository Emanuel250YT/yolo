import { useEffect, useState } from "react";
import type { SpotHold } from "../types";

interface PaymentHoldBannerProps {
  hold: SpotHold;
  spotLabel?: string;
  onPay: (method: "cash" | "mercadopago") => void;
  onCancel: () => void;
  paying?: boolean;
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PaymentHoldBanner({
  hold,
  spotLabel,
  onPay,
  onCancel,
  paying,
}: PaymentHoldBannerProps) {
  const [remaining, setRemaining] = useState(
    () => new Date(hold.expiresAt).getTime() - Date.now(),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(new Date(hold.expiresAt).getTime() - Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, [hold.expiresAt]);

  const expired = remaining <= 0;

  return (
    <aside className={`payment-hold-banner${expired ? " expired" : ""}`}>
      <div className="hold-header">
        <strong>Plaza seleccionada{spotLabel ? `: ${spotLabel}` : ""}</strong>
        <span className={`hold-timer${remaining < 120_000 ? " urgent" : ""}`}>
          {expired ? "Tiempo agotado" : formatCountdown(remaining)}
        </span>
      </div>
      <p className="hold-desc">
        Tenés <strong>10 minutos</strong> para completar el pago virtual. Pasado
        ese tiempo la plaza vuelve a quedar libre.
      </p>
      <p className="hold-amount">
        Total: ${hold.pricing.net.toLocaleString("es-AR")} · {hold.plate}
      </p>
      <div className="hold-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={expired || paying}
          onClick={() => onPay("mercadopago")}
        >
          {paying ? "Procesando…" : "Pagar con Mercado Pago"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={expired || paying}
          onClick={() => onPay("cash")}
        >
          Efectivo / transferencia
        </button>
        <button
          type="button"
          className="btn-ghost btn-small"
          disabled={paying}
          onClick={onCancel}
        >
          Liberar plaza
        </button>
      </div>
    </aside>
  );
}
