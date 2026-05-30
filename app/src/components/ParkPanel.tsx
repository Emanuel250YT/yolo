import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { ParkingZone, Session, ShiftStatus } from "../types";
import { zoneOptionsForPermit } from "../utils/zoneDefaults";
import { zoneCodeOptions } from "../utils/selectOptions";
import { OutOfHoursNotice } from "./OutOfHoursNotice";
import { PriceCard } from "./PriceCard";
import { SearchableSelect } from "./SearchableSelect";

interface ParkPanelProps {
  shift: ShiftStatus | null;
  onSessionChange: () => void;
  defaultZone?: string;
  zones?: ParkingZone[];
  lockZone?: boolean;
}

export function ParkPanel({
  shift,
  onSessionChange,
  defaultZone = "",
  zones = [],
  lockZone = false,
}: ParkPanelProps) {
  const [plate, setPlate] = useState("");
  const [vehicleType, setVehicleType] = useState<"auto" | "motorcycle">("auto");
  const [zone, setZone] = useState(defaultZone || "microcentro");
  const [digitalPayment, setDigitalPayment] = useState(true);
  const [permitId, setPermitId] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zoneOptions = useMemo(
    () => zoneOptionsForPermit(zones, defaultZone, !lockZone),
    [zones, defaultZone, lockZone],
  );

  const zoneSelectOpts = useMemo(
    () => zoneCodeOptions(zones, zoneOptions),
    [zones, zoneOptions],
  );

  useEffect(() => {
    if (defaultZone) setZone(defaultZone);
  }, [defaultZone]);

  const canStart = shift?.canCharge ?? true;

  async function startParking(e: React.FormEvent) {
    e.preventDefault();
    if (!canStart) return;
    setLoading(true);
    setError(null);
    try {
      const { session: created } = await api.createSession({
        plate,
        vehicleType,
        zone,
        digitalPayment,
        permitId: permitId || undefined,
      });
      setSession(created);
      onSessionChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar");
    } finally {
      setLoading(false);
    }
  }

  async function finishParking() {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { session: done } = await api.checkout(session.id, digitalPayment);
      setSession(done);
      onSessionChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo finalizar");
    } finally {
      setLoading(false);
    }
  }

  function elapsedMinutes(s: Session) {
    const start = new Date(s.startedAt).getTime();
    const end = s.endedAt ? new Date(s.endedAt).getTime() : Date.now();
    return Math.max(0, Math.round((end - start) / 60000));
  }

  const showOutOfHours = !canStart && !session;

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Iniciar / finalizar estacionamiento</h2>
        <p>Registro digital con trazabilidad para conductores y permisionarios.</p>
      </header>

      {showOutOfHours ? (
        <OutOfHoursNotice
          shift={shift}
          title="No se pueden efectuar cobros en este horario"
        />
      ) : (
        (!session || session.status === "active") && (
          <form className="form-grid" onSubmit={startParking}>
            <label>
              Patente *
              <input
                required
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="AB123CD"
                disabled={!!session}
              />
            </label>

            <label>
              Tipo de vehículo
              <select
                value={vehicleType}
                disabled={!!session}
                onChange={(e) =>
                  setVehicleType(e.target.value as "auto" | "motorcycle")
                }
              >
                <option value="auto">Automóvil</option>
                <option value="motorcycle">Motocicleta</option>
              </select>
            </label>

            <label>
              Zona / cuadra
              <SearchableSelect
                value={zone}
                disabled={!!session || lockZone}
                onChange={setZone}
                options={zoneSelectOpts}
              />
            </label>

            <label>
              Legajo permisionario (opcional)
              <input
                value={permitId}
                disabled={!!session}
                onChange={(e) => setPermitId(e.target.value)}
                placeholder="Ej. 4521"
              />
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={digitalPayment}
                disabled={!!session}
                onChange={(e) => setDigitalPayment(e.target.checked)}
              />
              Pago digital
            </label>

            {!session ? (
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? "Registrando…" : "Iniciar estacionamiento"}
              </button>
            ) : (
              <button
                type="button"
                className="btn-accent"
                disabled={loading}
                onClick={finishParking}
              >
                {loading ? "Finalizando…" : "Finalizar y cobrar"}
              </button>
            )}
          </form>
        )
      )}

      {error && <p className="form-error">{error}</p>}

      {session && (
        <div className="session-active">
          <p className="session-id">Sesión {session.id.slice(0, 8)}…</p>
          <p>
            <strong>{session.plate}</strong> · {session.zone} ·{" "}
            {session.status === "active" ? "En curso" : "Finalizada"}
          </p>
          <p className="meta">
            Inicio: {new Date(session.startedAt).toLocaleString("es-AR")}
            {session.status === "active" && (
              <> · {elapsedMinutes(session)} min transcurridos</>
            )}
          </p>
          {session.checkout && (
            <PriceCard
              title="Comprobante de cobro"
              plate={session.plate}
              minutes={session.checkout.minutes}
              pricing={session.checkout}
            />
          )}
        </div>
      )}
    </section>
  );
}
