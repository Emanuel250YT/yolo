import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { parseDevAccounts } from "./devConfig";
import { useDevTools } from "./DevToolsContext";
import type { DevShiftOverride } from "./devConfig";

export function DevToolsPanel() {
  const { enabled, shiftOverride, setShiftOverride, geoOverride, setGeoOverride } =
    useDevTools();
  const { user, login, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) return null;

  const accounts = parseDevAccounts();

  async function switchAccount(email: string, password: string) {
    setBusy(true);
    setError(null);
    try {
      logout();
      await login(email, password);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar cuenta");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`dev-tools${open ? " dev-tools--open" : ""}`}>
      <button
        type="button"
        className="dev-tools-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        DEV
      </button>

      {open && (
        <div className="dev-tools-panel">
          <h4 className="dev-tools-title">Herramientas de desarrollo</h4>

          {user && (
            <p className="dev-tools-meta">
              Sesión: <strong>{user.name}</strong> ({user.role})
            </p>
          )}

          {accounts.length > 0 && (
            <section className="dev-tools-section">
              <p className="dev-tools-label">Cambiar cuenta</p>
              <div className="dev-tools-actions">
                {accounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    className="btn-small"
                    disabled={busy}
                    onClick={() => switchAccount(acc.email, acc.password)}
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="dev-tools-section">
            <p className="dev-tools-label">Horario de cobro</p>
            <select
              value={shiftOverride}
              onChange={(e) =>
                setShiftOverride(e.target.value as DevShiftOverride)
              }
            >
              <option value="auto">Automático (servidor)</option>
              <option value="open">Forzar abierto</option>
              <option value="closed">Forzar cerrado</option>
              <option value="day">Turno diurno</option>
              <option value="night">Turno nocturno</option>
            </select>
          </section>

          <section className="dev-tools-section">
            <label className="dev-tools-check">
              <input
                type="checkbox"
                checked={geoOverride.enabled}
                onChange={(e) =>
                  setGeoOverride({ ...geoOverride, enabled: e.target.checked })
                }
              />
              Simular ubicación GPS
            </label>
            {geoOverride.enabled && (
              <div className="dev-tools-grid">
                <label>
                  Lat
                  <input
                    type="number"
                    step="0.0001"
                    value={geoOverride.lat}
                    onChange={(e) =>
                      setGeoOverride({
                        ...geoOverride,
                        lat: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Lng
                  <input
                    type="number"
                    step="0.0001"
                    value={geoOverride.lng}
                    onChange={(e) =>
                      setGeoOverride({
                        ...geoOverride,
                        lng: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
            )}
          </section>

          {error && <p className="form-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
