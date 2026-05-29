import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import type { User, UserRole } from "../types";

const NAV = [
  { id: "pendientes", label: "Pendientes" },
  { id: "crear", label: "Crear cuenta" },
  { id: "usuarios", label: "Todos los usuarios" },
];

export function MunicipioDashboard() {
  const [tab, setTab] = useState("pendientes");
  const [pending, setPending] = useState<User[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    name: "",
    role: "permisionario" as UserRole,
    legajo: "",
    zone: "microcentro",
    active: true,
  });

  const load = useCallback(async () => {
    try {
      const [p, all] = await Promise.all([
        api.municipioPendingUsers(),
        api.municipioUsers(),
      ]);
      setPending(p.users);
      setUsers(all.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function activate(id: string) {
    setMessage(null);
    const res = await api.municipioActivateUser(id);
    setMessage(res.message);
    load();
  }

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      await api.municipioCreateUser(form);
      setMessage("Cuenta creada y habilitada para iniciar sesión.");
      setForm({
        email: "",
        password: "",
        name: "",
        role: "permisionario",
        legajo: "",
        zone: "microcentro",
        active: true,
      });
      load();
      setTab("usuarios");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <AppShell
      title="Municipalidad"
      subtitle="Habilitación de permisionarios y administradores"
      nav={NAV}
      tab={tab}
      onTab={setTab}
    >
      {message && <p className="success-inline">{message}</p>}
      {error && <p className="form-error banner-error">{error}</p>}

      {tab === "pendientes" && (
        <section className="panel">
          <h2>Solicitudes pendientes ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className="empty">No hay cuentas pendientes de habilitación.</p>
          ) : (
            <ul className="card-list">
              {pending.map((u) => (
                <li key={u.id} className="list-card">
                  <strong>{u.name}</strong>
                  <span className="chip">{u.role}</span>
                  <p className="meta">{u.email}</p>
                  {u.legajo && <p className="meta">Legajo {u.legajo}</p>}
                  <button
                    type="button"
                    className="btn-primary btn-small"
                    onClick={() => activate(u.id)}
                  >
                    Habilitar cuenta
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "crear" && (
        <section className="panel">
          <h2>Alta directa (activa al crear)</h2>
          <form className="form-standard" onSubmit={createStaff}>
            <div className="field">
              <label>Tipo de cuenta</label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as UserRole })
                }
              >
                <option value="permisionario">Permisionario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="field">
              <label>Nombre</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Contraseña temporal</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
              />
            </div>
            {form.role === "permisionario" && (
              <>
                <div className="field">
                  <label>Legajo</label>
                  <input
                    required
                    value={form.legajo}
                    onChange={(e) =>
                      setForm({ ...form, legajo: e.target.value })
                    }
                  />
                </div>
                <div className="field">
                  <label>Zona</label>
                  <input
                    value={form.zone}
                    onChange={(e) => setForm({ ...form, zone: e.target.value })}
                  />
                </div>
              </>
            )}
            <button type="submit" className="btn-primary btn-block">
              Crear y habilitar
            </button>
          </form>
        </section>
      )}

      {tab === "usuarios" && (
        <section className="panel">
          <h2>Usuarios del sistema</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.name}</td>
                    <td>{u.email}</td>
                    <td>{u.role}</td>
                    <td>
                      {u.active
                        ? "Activo"
                        : u.activationPending
                          ? "Pendiente"
                          : "Inactivo"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}
