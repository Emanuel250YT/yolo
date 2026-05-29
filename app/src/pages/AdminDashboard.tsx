import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import type {
  AdminOverview,
  HistoryEntry,
  Permit,
  Reservation,
  User,
  UserRole,
} from "../types";

const NAV = [
  { id: "resumen", label: "Resumen" },
  { id: "usuarios", label: "Usuarios" },
  { id: "permisos", label: "Permisos" },
  { id: "historial", label: "Historial" },
  { id: "reservas", label: "Reservas" },
];

export function AdminDashboard() {
  const [tab, setTab] = useState("resumen");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [permits, setPermits] = useState<Permit[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "permisionario" as UserRole,
    legajo: "",
    zone: "microcentro",
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [o, u, p, h, r] = await Promise.all([
        api.adminOverview(),
        api.adminUsers(),
        api.adminPermits(),
        api.adminHistory(),
        api.adminReservations(),
      ]);
      setOverview(o);
      setUsers(u.users);
      setPermits(p.permits);
      setHistory(h.history);
      setReservations(r.reservations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.adminCreateUser(form);
      setForm({
        email: "",
        password: "",
        name: "",
        role: "permisionario",
        legajo: "",
        zone: "microcentro",
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  async function toggleUser(u: User) {
    await api.adminUpdateUser(u.id, { active: !u.active });
    load();
  }

  return (
    <AppShell
      title="Administración SEM"
      subtitle="Gestión integral del sistema"
      nav={NAV}
      tab={tab}
      onTab={setTab}
    >
      {error && <p className="form-error banner-error">{error}</p>}

      {tab === "resumen" && overview && (
        <div className="stat-grid">
          {(
            [
              ["users", "Usuarios"],
              ["permits", "Permisos"],
              ["spots", "Lugares"],
              ["reservations", "Reservas"],
              ["sessions", "Sesiones"],
              ["history", "Historial"],
            ] as const
          ).map(([k, label]) => (
            <article key={k} className="stat-card">
              <span className="stat-val">{overview[k]}</span>
              <span className="stat-lbl">{label}</span>
            </article>
          ))}
        </div>
      )}

      {tab === "usuarios" && (
        <div className="split-panel">
          <section className="panel">
            <h2>Crear cuenta</h2>
            <p className="panel-desc">
              Permisionarios y administradores requieren alta obligatoria por la
              Municipalidad.
            </p>
            <form className="form-grid" onSubmit={createUser}>
              <label>
                Nombre
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </label>
              <label>
                Contraseña
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                />
              </label>
              <label>
                Rol
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as UserRole })
                  }
                >
                  <option value="permisionario">Permisionario</option>
                  <option value="admin">Administrador</option>
                  <option value="conductor">Conductor</option>
                </select>
              </label>
              {form.role === "permisionario" && (
                <>
                  <label>
                    Legajo *
                    <input
                      required
                      value={form.legajo}
                      onChange={(e) =>
                        setForm({ ...form, legajo: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Zona
                    <input
                      value={form.zone}
                      onChange={(e) =>
                        setForm({ ...form, zone: e.target.value })
                      }
                    />
                  </label>
                </>
              )}
              <button type="submit" className="btn-primary">
                Crear usuario
              </button>
            </form>
          </section>

          <section className="panel">
            <h2>Usuarios ({users.length})</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className="chip">{u.role}</span>
                      </td>
                      <td>{u.active ? "Activo" : "Inactivo"}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-small"
                          onClick={() => toggleUser(u)}
                        >
                          {u.active ? "Desactivar" : "Activar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === "permisos" && (
        <section className="panel">
          <h2>Permisos de estacionamiento ({permits.length})</h2>
          <div className="card-list">
            {permits.map((p) => (
              <article key={p.id} className="list-card">
                <strong>{p.plate}</strong>
                <span className="chip">{p.zone}</span>
                <p>
                  {p.permisionarioName} · Leg. {p.permisionarioLegajo}
                </p>
                <p className="meta">{p.status} · {p.vehicleType}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "historial" && (
        <section className="panel">
          <h2>Historial global</h2>
          <ul className="history-list">
            {history.map((h) => (
              <li key={h.id}>
                <span className={`hist-action ${h.action}`}>{h.action}</span>
                <strong>{h.userName}</strong>
                <p>{h.observation || "Modificación registrada"}</p>
                <time>{new Date(h.createdAt).toLocaleString("es-AR")}</time>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "reservas" && (
        <section className="panel">
          <h2>Reservas conductores</h2>
          <div className="card-list">
            {reservations.map((r) => (
              <article key={r.id} className="list-card">
                <strong>{r.plate}</strong> @ {r.spotLabel}
                <p>
                  ${r.pricing.net.toLocaleString("es-AR")} · {r.status}
                </p>
                <time className="meta">
                  {new Date(r.scheduledStart).toLocaleString("es-AR")}
                </time>
              </article>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
