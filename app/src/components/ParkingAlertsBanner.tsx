import { useEffect, useState } from "react";
import type { ParkingAlert } from "../types";

function formatRemaining(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

interface ParkingAlertsBannerProps {
  alerts: ParkingAlert[];
  onRenew?: (plate: string) => void;
}

export function ParkingAlertsBanner({
  alerts,
  onRenew,
}: ParkingAlertsBannerProps) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!alerts.length) return;
    const id = window.setInterval(() => tick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, [alerts.length]);

  if (!alerts.length) return null;

  return (
    <div className="parking-alerts">
      {alerts.map((alert) => {
        const remaining = Math.max(
          0,
          Math.round(
            (new Date(alert.endAt).getTime() - Date.now()) / 60_000,
          ),
        );
        const urgent = remaining <= 15;

        return (
          <article
            key={alert.permitId}
            className={`parking-alert ${urgent ? "urgent" : ""}`}
          >
            <div className="parking-alert-body">
              <strong>Estacionamiento activo — {alert.plate}</strong>
              <p>
                Zona <span className="chip">{alert.zone}</span>
              </p>
              <p className="parking-alert-time">
                {remaining > 0 ? (
                  <>
                    Vence en{" "}
                    <strong>{formatRemaining(remaining)}</strong>
                    <span className="field-hint">
                      {" "}
                      (hasta{" "}
                      {new Date(alert.endAt).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      )
                    </span>
                  </>
                ) : (
                  <strong>Tiempo vencido</strong>
                )}
              </p>
            </div>
            {onRenew && (
              <button
                type="button"
                className="btn-small btn-primary"
                onClick={() => onRenew(alert.plate)}
              >
                Renovar tiempo
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
