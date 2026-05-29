import { useState } from "react";
import { api } from "../api/client";
import type { Session } from "../types";
import { PriceCard } from "./PriceCard";

interface SessionsListProps {
  sessions: Session[];
  onRefresh: () => void;
}

export function SessionsList({ sessions, onRefresh }: SessionsListProps) {
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = sessions.filter((s) => s.status === "active");
  const completed = sessions.filter((s) => s.status === "completed");

  async function checkout(id: string) {
    setCheckingOut(id);
    setError(null);
    try {
      await api.checkout(id);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cobrar");
    } finally {
      setCheckingOut(null);
    }
  }

  function elapsed(s: Session) {
    const ms = Date.now() - new Date(s.startedAt).getTime();
    return Math.max(0, Math.round(ms / 60000));
  }

  return (
    <section className="panel">
      <header className="panel-head row-between">
        <div>
          <h2>Sesiones registradas</h2>
          <p>{active.length} activa(s) · {completed.length} finalizada(s)</p>
        </div>
        <button type="button" className="btn-ghost" onClick={onRefresh}>
          Actualizar
        </button>
      </header>

      {error && <p className="form-error">{error}</p>}

      {sessions.length === 0 ? (
        <p className="empty">No hay sesiones. Iniciá una desde Estacionar.</p>
      ) : (
        <ul className="session-list">
          {sessions.map((s) => (
            <li key={s.id} className={s.status}>
              <div className="session-row">
                <div>
                  <strong>{s.plate}</strong>
                  <span className="chip">{s.vehicleType}</span>
                  <span className="chip muted">{s.zone}</span>
                </div>
                <span className={`state ${s.status}`}>
                  {s.status === "active" ? "Activa" : "Cobrada"}
                </span>
              </div>
              <p className="meta">
                {new Date(s.startedAt).toLocaleString("es-AR")}
                {s.status === "active" && ` · ${elapsed(s)} min`}
              </p>
              {s.status === "active" && (
                <button
                  type="button"
                  className="btn-small"
                  disabled={checkingOut === s.id}
                  onClick={() => checkout(s.id)}
                >
                  {checkingOut === s.id ? "Cobrando…" : "Cobrar ahora"}
                </button>
              )}
              {s.checkout && (
                <PriceCard
                  title="Cobro"
                  plate={s.plate}
                  minutes={s.checkout.minutes}
                  pricing={s.checkout}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
