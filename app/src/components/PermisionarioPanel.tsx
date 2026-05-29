import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { ParkPanel } from "./ParkPanel";
import { ShiftBanner } from "./ShiftBanner";
import type { HistoryEntry, ParkingZone, Permit, User } from "../types";

interface PermisionarioPanelProps {
  isAdmin?: boolean;
  permisionarios?: User[];
  activeTab: string;
}

export function PermisionarioPanel({
  isAdmin = false,
  permisionarios = [],
  activeTab,
}: PermisionarioPanelProps) {
  const [permits, setPermits] = useState<Permit[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [zones, setZones] = useState<ParkingZone[]>([]);
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
    permisionarioId: "",
  });

  const load = useCallback(async () => {
    try {
      const [p, h, s, z] = await Promise.all([
        api.permits(),
        api.permHistory(),
        api.shiftStatus(),
        api.parkingZones().catch(() => ({ zones: [] as ParkingZone[] })),
      ]);
      setPermits(p.permits);
      setHistory(h.history);
      setShift(s);
      setZones(z.zones.filter((x) => x.enabled));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isAdmin && permisionarios.length) {
      setForm((f) =>
        f.permisionarioId
          ? f
          : { ...f, permisionarioId: permisionarios[0].id },
      );
    }
  }, [isAdmin, permisionarios]);

  const zoneOptions = [
    ...zones.map((z) => ({ value: z.code, label: z.name })),
    ...(zones.some((z) => z.code === form.zone)
      ? []
      : [{ value: form.zone, label: form.zone }]),
  ];

  async function createPermit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: Record<string, unknown> = {
        plate: form.plate,
        zone: form.zone,
        vehicleType: form.vehicleType,
        notes: form.notes,
      };
      if (isAdmin) {
        payload.permisionarioId = form.permisionarioId;
      }
      await api.createPermit(payload);
      setForm({
        plate: "",
        zone: zones[0]?.code ?? "microcentro",
        vehicleType: "auto",
        notes: "",
        permisionarioId: permisionarios[0]?.id ?? form.permisionarioId,
      });
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
    <>
      <ShiftBanner shift={shift} tariffs={null} />
      {error && <p className="form-error banner-error">{error}</p>}

      {activeTab === "nuevo" && (
        <section className="panel">
          <h2>Crear permiso de estacionamiento</h2>
          <form className="form-grid" onSubmit={createPermit}>
            {isAdmin && (
              <label>
                Permisionario *
                <select
                  required
                  value={form.permisionarioId}
                  onChange={(e) =>
                    setForm({ ...form, permisionarioId: e.target.value })
                  }
                >
                  {permisionarios.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · Leg. {u.legajo ?? "—"}
                    </option>
                  ))}
                </select>
              </label>
            )}
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
              <select
                value={form.zone}
                onChange={(e) => setForm({ ...form, zone: e.target.value })}
              >
                {zoneOptions.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </select>
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

      {activeTab === "permisos" && (
        <div className="split-panel">
          <section className="panel">
            <h2>{isAdmin ? "Permisos" : "Mis permisos"} ({permits.length})</h2>
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
                  {isAdmin && (
                    <p className="meta">{p.permisionarioName}</p>
                  )}
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
                  <select
                    defaultValue={selected.zone}
                    onChange={(e) => partialUpdate("zone", e.target.value)}
                  >
                    {zoneOptions.map((z) => (
                      <option key={z.value} value={z.value}>
                        {z.label}
                      </option>
                    ))}
                  </select>
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

      {activeTab === "historial" && (
        <section className="panel">
          <h2>Historial de cambios</h2>
          <ul className="history-list">
            {history.map((h) => (
              <li key={h.id}>
                <span className={`hist-action ${h.action}`}>{h.action}</span>
                {isAdmin && <strong>{h.userName}</strong>}
                <p>{h.observation || JSON.stringify(h.after ?? {})}</p>
                <time>{new Date(h.createdAt).toLocaleString("es-AR")}</time>
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeTab === "sesiones" && (
        <ParkPanel shift={shift} onSessionChange={load} />
      )}
    </>
  );
}
