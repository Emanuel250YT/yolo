import type { ShiftStatus, Tariffs } from "../types";

interface ShiftBannerProps {
  shift: ShiftStatus | null;
  tariffs: Tariffs | null;
}

export function ShiftBanner({ shift, tariffs }: ShiftBannerProps) {
  if (!shift) return null;

  return (
    <div className={`shift-banner ${shift.canCharge ? "open" : "closed"}`}>
      <div>
        <p className="shift-label">
          {shift.canCharge ? "Cobro habilitado" : "Cobro no habilitado"}
          {shift.simulatedClock && (
            <span className="chip chip--dev">Reloj simulado</span>
          )}
        </p>
        <p className="shift-msg">{shift.message}</p>
      </div>
      {tariffs && (
        <div className="shift-rates">
          <span>Auto ${tariffs.autoPerHour}/h</span>
          <span>Moto ${tariffs.motorcyclePerHour}/h</span>
          <span>−{Math.round(tariffs.digitalDiscountRate * 100)}% digital</span>
        </div>
      )}
    </div>
  );
}
