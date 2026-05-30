import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../api/client";
import type { DevSpotSimStatus, ParkingZone } from "../types";
import {
  bumpDevClockMinutes,
  formatDatetimeLocal,
  formatDevClockDisplay,
  getDevNow,
  parseDatetimeLocal,
  parseDevAccounts,
} from "./devConfig";
import { useDevTools } from "./DevToolsContext";
import type { DevShiftOverride } from "./devConfig";

export function DevToolsPanel() {
  const {
    enabled,
    ready,
    clientEnabled,
    serverEnabled,
    shiftOverride,
    setShiftOverride,
    clockOverride,
    setClockOverride,
    geoOverride,
    setGeoOverride,
    bumpRefresh,
  } = useDevTools();
  const { user, login } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zones, setZones] = useState<ParkingZone[]>([]);
  const [simZone, setSimZone] = useState("");
  const [simCount, setSimCount] = useState(8);
  const [simStatus, setSimStatus] = useState<DevSpotSimStatus | null>(null);

  useEffect(() => {
    if (!open || !enabled) return;
    void api.parkingZones({ pageSize: 100 }).then((res) => {
      const list = res.zones.filter((z) => z.enabled);
      setZones(list);
      setSimZone((prev) => prev || list[0]?.code || "");
    });
    void api.devSpotSimStatus().then((res) => setSimStatus(res.status)).catch(() => {});
  }, [open, enabled]);

  useEffect(() => {
    if (!simStatus?.running) return;
    const id = window.setInterval(() => {
      void api
        .devSpotSimStatus()
        .then((res) => {
          setSimStatus(res.status);
          bumpRefresh();
        })
        .catch(() => {});
    }, 3000);
    return () => window.clearInterval(id);
  }, [simStatus?.running, bumpRefresh]);

  if (!ready || !enabled) return null;

  const accounts = parseDevAccounts();
  const effectiveNow = clockOverride.enabled
    ? formatDevClockDisplay(clockOverride.iso)
    : formatDevClockDisplay(getDevNow().toISOString());

  async function switchAccount(email: string, password: string) {
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cambiar cuenta");
    } finally {
      setBusy(false);
    }
  }

  function enableClockWithNow() {
    setClockOverride({
      enabled: true,
      iso: getDevNow().toISOString(),
    });
  }

  function bumpClock(minutes: number) {
    setClockOverride(bumpDevClockMinutes(minutes));
  }

  async function startSpotSim() {
    if (!simZone) {
      setError("Elegí una zona.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.startDevSpotSim(simZone, simCount);
      setSimStatus(res.status);
      bumpRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function stopSpotSim() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.stopDevSpotSim();
      setSimStatus(res.status);
      bumpRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
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
          <p className="dev-tools-meta">
            Frontend: {clientEnabled ? "on" : "off"} · Servidor:{" "}
            {serverEnabled ? "on" : "off"}
          </p>

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
            <p className="dev-tools-label">Reloj simulado</p>
            <label className="dev-tools-check">
              <input
                type="checkbox"
                checked={clockOverride.enabled}
                onChange={(e) => {
                  if (e.target.checked) {
                    enableClockWithNow();
                  } else {
                    setClockOverride({ ...clockOverride, enabled: false });
                  }
                }}
              />
              Usar hora simulada (en vez de la PC)
            </label>
            {clockOverride.enabled && (
              <>
                <p className="dev-tools-meta">
                  Efectiva: <strong>{effectiveNow}</strong>
                </p>
                <label className="dev-tools-datetime">
                  Fecha y hora
                  <input
                    type="datetime-local"
                    value={formatDatetimeLocal(clockOverride.iso)}
                    onChange={(e) =>
                      setClockOverride({
                        enabled: true,
                        iso: parseDatetimeLocal(e.target.value),
                      })
                    }
                  />
                </label>
                <div className="dev-tools-actions">
                  <button
                    type="button"
                    className="btn-small btn-ghost"
                    onClick={() => bumpClock(15)}
                  >
                    +15 min
                  </button>
                  <button
                    type="button"
                    className="btn-small btn-ghost"
                    onClick={() => bumpClock(60)}
                  >
                    +1 h
                  </button>
                  <button
                    type="button"
                    className="btn-small btn-ghost"
                    onClick={() =>
                      setClockOverride({
                        enabled: true,
                        iso: new Date().toISOString(),
                      })
                    }
                  >
                    Ahora (PC)
                  </button>
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() => void api.runDevExpiry().then(() => bumpRefresh())}
                  >
                    Caducar activos
                  </button>
                </div>
                <p className="dev-tools-hint">
                  El servidor revisa permisos, holds, pagos y reservas cada
                  minuto usando esta hora simulada.
                </p>
              </>
            )}
          </section>

          <section className="dev-tools-section">
            <p className="dev-tools-label">Horario de cobro</p>
            <select
              value={shiftOverride}
              onChange={(e) =>
                setShiftOverride(e.target.value as DevShiftOverride)
              }
            >
              <option value="auto">
                Automático (según reloj simulado / servidor)
              </option>
              <option value="open">Forzar abierto</option>
              <option value="closed">Forzar cerrado</option>
              <option value="day">Turno diurno</option>
              <option value="night">Turno nocturno</option>
            </select>
            <p className="dev-tools-hint">
              Con «Automático» y reloj simulado podés probar fuera de horario
              sin forzar el turno.
            </p>
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

          <section className="dev-tools-section">
            <p className="dev-tools-label">Simular ocupación (mapas)</p>
            <p className="dev-tools-hint">
              Crea reservas confirmadas al instante (ocupan plazas en el
              backend); cada una vence en 10–60 s con expiración real.
            </p>
            <label>
              Zona
              <select
                value={simZone}
                disabled={simStatus?.running || busy}
                onChange={(e) => setSimZone(e.target.value)}
              >
                {zones.length === 0 && <option value="">Cargando…</option>}
                {zones.map((z) => (
                  <option key={z.id} value={z.code}>
                    {z.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cantidad de plazas
              <input
                type="number"
                min={1}
                max={500}
                value={simCount}
                disabled={simStatus?.running || busy}
                onChange={(e) =>
                  setSimCount(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </label>
            <div className="dev-tools-actions">
              {!simStatus?.running ? (
                <button
                  type="button"
                  className="btn-small btn-primary"
                  disabled={busy || !simZone}
                  onClick={() => void startSpotSim()}
                >
                  Iniciar simulación
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-small btn-danger"
                  disabled={busy}
                  onClick={() => void stopSpotSim()}
                >
                  Detener y liberar
                </button>
              )}
            </div>
            {simStatus && (
              <p className="dev-tools-meta">
                {simStatus.running ? (
                  <>
                    Activa · <strong>{simStatus.occupiedCount}</strong>/
                    {simStatus.targetCount} en {simStatus.zoneCode}
                    {simStatus.lastAction && (
                      <>
                        <br />
                        {simStatus.lastAction}
                      </>
                    )}
                  </>
                ) : (
                  "Detenida"
                )}
              </p>
            )}
          </section>

          {error && <p className="form-error">{error}</p>}
        </div>
      )}
    </div>
  );
}
