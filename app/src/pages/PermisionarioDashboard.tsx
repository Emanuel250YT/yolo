import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { ParkPanel } from "../components/ParkPanel";
import { ShiftBanner } from "../components/ShiftBanner";
import type { HistoryEntry, Permit } from "../types";

const NAV = [
  { id: "permisos", label: "Permisos" },
  { id: "nuevo", label: "Nuevo permiso" },
  { id: "historial", label: "Historial" },
  { id: "sesiones", label: "Sesiones" },
];

export function PermisionarioDashboard() {
  const [tab, setTab] = useState("permisos");
  const [permits, setPermits] = useState<Permit[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [shift, setShift] = useState<Awaited<
    ReturnType<typeof api.shiftStatus>
  > | null>(null);
  const [selected, setSelected] = useState<Permit | null>(null);
  const [observation, setObservation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    plate: "",
    zone: "microcentro",
    vehicleType: "auto" as "auto" | "motorcycle",
    notes: "",
  });

  const load = useCallback(async () => {
    try {
      const [p, h, s] = await Promise.all([
        api.permits(),
        api.permHistory(),
        api.shiftStatus(),
      ]);
      setPermits(p.permits);
      setHistory(h.history);
      setShift(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createPermit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.createPermit(form);
      setForm({ plate: "", zone: "microcentro", vehicleType: "auto", notes: "" });
      setTab("permisos");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function saveObservation() {
    if (!selected || !observation.trim()) return;
    try {
      await api.addObservation(selected.id, observation);
      setObservation("");
      load();
      const { history: h } = await api.permitHistory(selected.id);
      setHistory(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function partialUpdate(field: string, value: string) {
    if (!selected) return;
    try {
      await api.updatePermit(selected.id, {
        [field]: value,
        observation: `Ajuste de ${field}`,
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <AppShell
      title="Panel permisionario"
      subtitle="Permisos, observaciones y modificaciones con historial"
      nav={NAV}
      tab={tab}
      onTab={setTab}
    >
      <ShiftBanner shift={shift} tariffs={null} />
      {error && <p className="form-error banner-error">{error}</p>}

      {tab === "nuevo" && (
        <section className="panel">
          <h2>Crear permiso de estacionamiento</h2>
          <form className="form-grid" onSubmit={createPermit}>
            <label>
              Patente *
              <input
                required
                value={form.plate}
                onChange={(e) =>
                  setForm({ ...form, plate: e.target.value.toUpperCase() })
                }
              />
            </label>
            <label>
              Zona
              <input
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
              />
            </label>
            <label>
              Vehículo
              <select
                value={form.vehicleType}
                onChange={(e) =>
                  setForm({
                    ...form,
                    vehicleType: e.target.value as "auto" | "motorcycle",
                  })
                }
              >
                <option value="auto">Automóvil</option>
                <option value="motorcycle">Motocicleta</option>
              </select>
            </label>
            <label>
              Notas
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
            <button type="submit" className="btn-primary">
              Registrar permiso
            </button>
          </form>
        </section>
      )}

      {tab === "permisos" && (
        <div className="split-panel">
          <section className="panel">
            <h2>Mis permisos ({permits.length})</h2>
            <div className="card-list">
              {permits.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`list-card clickable ${selected?.id === p.id ? "selected" : ""}`}
                  onClick={() => setSelected(p)}
                >
                  <strong>{p.plate}</strong>
                  <span className="chip">{p.status}</span>
                  <p className="meta">{p.zone}</p>
                </button>
              ))}
            </div>
          </section>

          {selected && (
            <section className="panel">
              <h2>Editar {selected.plate}</h2>
              <div className="form-grid">
                <label>
                  Estado
                  <select
                    defaultValue={selected.status}
                    onChange={(e) => partialUpdate("status", e.target.value)}
                  >
                    <option value="active">Activo</option>
                    <option value="completed">Completado</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </label>
                <label>
                  Zona
                  <input
                    defaultValue={selected.zone}
                    onBlur={(e) => partialUpdate("zone", e.target.value)}
                  />
                </label>
                <label>
                  Observación (queda en historial)
                  <textarea
                    rows={3}
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={saveObservation}
                >
                  Guardar observación
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {tab === "historial" && (
        <section className="panel">
          <h2>Historial de cambios</h2>
          <ul className="history-list">
            {history.map((h) => (
              <li key={h.id}>
                <span className={`hist-action ${h.action}`}>{h.action}</span>
                <p>{h.observation || JSON.stringify(h.after ?? {})}</p>
                <time>{new Date(h.createdAt).toLocaleString("es-AR")}</time>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "sesiones" && (
        <ParkPanel shift={shift} onSessionChange={load} />
      )}
    </AppShell>
  );
}
