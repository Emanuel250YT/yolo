import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { ParkingZoneManager } from "../components/ParkingZoneManager";
import { PermisionarioPanel } from "../components/PermisionarioPanel";
import type {
  AdminOverview,
  Reservation,
  User,
  UserRole,
} from "../types";

const NAV = [
  { id: "resumen", label: "Resumen" },
  { id: "permisos", label: "Permisos" },
  { id: "nuevo", label: "Nuevo permiso" },
  { id: "sesiones", label: "Sesiones" },
  { id: "historial", label: "Historial" },
  { id: "zonas", label: "Zonas parking" },
  { id: "usuarios", label: "Usuarios" },
  { id: "reservas", label: "Reservas" },
];

const OPS_TABS = new Set(["permisos", "nuevo", "sesiones", "historial"]);

export function AdminDashboard() {
  const [tab, setTab] = useState("resumen");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
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

  const permisionarios = useMemo(
    () => users.filter((u) => u.role === "permisionario" && u.active),
    [users],
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const [o, u, r] = await Promise.all([
        api.adminOverview(),
        api.adminUsers(),
        api.adminReservations(),
      ]);
      setOverview(o);
      setUsers(u.users);
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
      wide
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
              ["parkingZones", "Zonas visión"],
              ["spots", "Lugares"],
              ["reservations", "Reservas"],
              ["sessions", "Sesiones"],
              ["history", "Historial"],
            ] as const
          ).map(([k, label]) => (
            <article key={k} className="stat-card">
              <span className="stat-val">{overview[k] ?? 0}</span>
              <span className="stat-lbl">{label}</span>
            </article>
          ))}
        </div>
      )}

      {OPS_TABS.has(tab) && (
        <PermisionarioPanel
          isAdmin
          permisionarios={permisionarios}
          activeTab={tab}
        />
      )}

      {tab === "zonas" && <ParkingZoneManager />}

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

      {tab === "reservas" && (
        <section className="panel">
          <h2>Reservas conductores ({reservations.length})</h2>
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
