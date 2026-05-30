import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { DashboardSummary } from "../components/DashboardSummary";
import { ParkingZoneManager } from "../components/ParkingZoneManager";
import { DataTable, RefCell } from "../components/DataTable";
import { PasswordInput } from "../components/PasswordInput";
import { SearchableSelect } from "../components/SearchableSelect";
import { PermisionarioPanel } from "../components/PermisionarioPanel";
import { TariffManager } from "../components/TariffManager";
import { useSubmitLock } from "../hooks/useSubmitLock";
import { useAuth } from "../auth/AuthContext";
import type { ParkingZone, User, UserRole } from "../types";
import { zoneIdOptions } from "../utils/selectOptions";
import { formatRef } from "../utils/formatRef";

const NAV = [
  { id: "resumen", label: "Resumen" },
  { id: "pendientes", label: "Pendientes" },
  { id: "zonas", label: "Zonas" },
  { id: "crear", label: "Crear cuenta" },
  { id: "usuarios", label: "Todos los usuarios" },
  { id: "permisos", label: "Permisos" },
  { id: "nuevo", label: "Nuevo permiso" },
  { id: "plazas", label: "Plazas" },
  { id: "historial", label: "Historial" },
  { id: "tarifas", label: "Tarifas" },
];

const OPS_TABS = new Set(["permisos", "nuevo", "plazas", "historial"]);

export function MunicipioDashboard() {
  const { user: actor } = useAuth();
  const [tab, setTab] = useState("resumen");
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
    parkingZoneId: "",
    active: true,
  });
  const [zones, setZones] = useState<ParkingZone[]>([]);

  const { busy: creatingStaff, run: runCreateStaff } = useSubmitLock();
  const { busy: togglingUser, run: runToggleUser } = useSubmitLock();
  const { busy: activating, run: runActivate } = useSubmitLock();

  const zoneOpts = useMemo(() => zoneIdOptions(zones), [zones]);
  const fetchDashboard = useCallback(() => api.municipioDashboard(), []);

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
    api.parkingZones().then((r) => {
      setZones(r.zones);
      setForm((f) => ({
        ...f,
        parkingZoneId: f.parkingZoneId || r.zones[0]?.id || "",
      }));
    });
  }, [load]);

  async function activate(id: string) {
    await runActivate(async () => {
      setMessage(null);
      const res = await api.municipioActivateUser(id);
      setMessage(res.message);
      await load();
      setTab("usuarios");
    });
  }

  async function toggleUser(u: User) {
    if (!actor || u.id === actor.id || togglingUser) return;
    await runToggleUser(async () => {
      setMessage(null);
      setError(null);
      try {
        if (u.active) {
          await api.municipioDeactivateUser(u.id);
          setMessage(`Cuenta de ${u.name} desactivada.`);
        } else {
          const res = await api.municipioActivateUser(u.id);
          setMessage(res.message);
        }
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    await runCreateStaff(async () => {
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
          parkingZoneId: zones[0]?.id ?? "",
          active: true,
        });
        await load();
        setTab("usuarios");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error");
      }
    });
  }

  return (
    <AppShell
      title="Municipalidad"
      subtitle="Habilitación de permisionarios y administradores"
      nav={NAV}
      tab={tab}
      onTab={setTab}
      mobileDock={{
        left: { tabId: "resumen", label: "Resumen" },
        center: { tabId: "nuevo", label: "Nuevo permiso" },
        right: { action: "menu", label: "Menú" },
      }}
    >
      {message && <p className="success-inline">{message}</p>}
      {error && <p className="form-error banner-error">{error}</p>}

      {tab === "resumen" && (
        <DashboardSummary fetchStats={fetchDashboard} showPendingUsers />
      )}

      {tab === "zonas" && <ParkingZoneManager apiMode="municipio" />}

      {tab === "pendientes" && (
        <section className="panel">
          <h2>Solicitudes pendientes</h2>
          <DataTable
            rows={pending}
            rowKey={(u) => u.id}
            searchPlaceholder="Buscar por ID, nombre, email…"
            emptyMessage="No hay cuentas pendientes de habilitación."
            columns={[
              {
                key: "ref",
                header: "ID",
                searchValues: (u) => [u.ref, u.id, u.name, u.email],
                render: (u) => <RefCell refId={formatRef(u)} />,
              },
              {
                key: "name",
                header: "Nombre",
                searchValues: (u) => [u.name],
                render: (u) => u.name,
              },
              {
                key: "email",
                header: "Email",
                searchValues: (u) => [u.email],
                render: (u) => u.email,
              },
              {
                key: "role",
                header: "Rol",
                searchValues: (u) => [u.role],
                render: (u) => <span className="chip">{u.role}</span>,
              },
              {
                key: "zone",
                header: "Zona",
                searchValues: (u) => [u.zoneName, u.zone],
                render: (u) => u.zoneName ?? u.zone ?? "—",
              },
              {
                key: "actions",
                header: "Acciones",
                render: (u) => (
                  <button
                    type="button"
                    className="btn-primary btn-small"
                    disabled={activating}
                    onClick={() => activate(u.id)}
                  >
                    {activating ? "…" : "Habilitar"}
                  </button>
                ),
              },
            ]}
          />
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
              <PasswordInput
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
                  <label>Zona asignada *</label>
                  <SearchableSelect
                    required
                    value={form.parkingZoneId}
                    onChange={(v) => setForm({ ...form, parkingZoneId: v })}
                    options={zoneOpts}
                  />
                </div>
              </>
            )}
            <button
              type="submit"
              className="btn-primary btn-block"
              disabled={creatingStaff}
            >
              {creatingStaff ? "Creando…" : "Crear y habilitar"}
            </button>
          </form>
        </section>
      )}

      {tab === "usuarios" && (
        <section className="panel">
          <h2>Usuarios del sistema</h2>
          <DataTable
            rows={users}
            rowKey={(u) => u.id}
            searchPlaceholder="Buscar por ID, nombre, email…"
            filters={[
              {
                key: "role",
                label: "Rol",
                options: [
                  { value: "permisionario", label: "Permisionario" },
                  { value: "admin", label: "Admin" },
                  { value: "conductor", label: "Conductor" },
                ],
              },
            ]}
            columns={[
              {
                key: "ref",
                header: "ID",
                searchValues: (u) => [u.ref, u.id, u.name, u.email],
                render: (u) => <RefCell refId={formatRef(u)} />,
              },
              {
                key: "name",
                header: "Nombre",
                searchValues: (u) => [u.name],
                render: (u) => u.name,
              },
              {
                key: "email",
                header: "Email",
                searchValues: (u) => [u.email],
                render: (u) => u.email,
              },
              {
                key: "role",
                header: "Rol",
                filterKey: "role",
                searchValues: (u) => [u.role],
                render: (u) => u.role,
              },
              {
                key: "zone",
                header: "Zona",
                searchValues: (u) => [u.zoneName, u.zone],
                render: (u) =>
                  u.role === "permisionario"
                    ? u.zoneName ?? u.zone ?? "—"
                    : "—",
              },
              {
                key: "status",
                header: "Estado",
                searchValues: (u) => [
                  u.active ? "activo" : u.activationPending ? "pendiente" : "inactivo",
                ],
                render: (u) =>
                  u.active
                    ? "Activo"
                    : u.activationPending
                      ? "Pendiente"
                      : "Inactivo",
              },
              {
                key: "actions",
                header: "Acciones",
                render: (u) => {
                  const isSelf = actor?.id === u.id;
                  const canToggle = !isSelf && u.role !== "municipio";
                  return canToggle ? (
                    <button
                      type="button"
                      className="btn-small"
                      disabled={togglingUser}
                      onClick={() => toggleUser(u)}
                    >
                      {u.active ? "Desactivar" : "Activar"}
                    </button>
                  ) : (
                    <span className="field-hint">
                      {isSelf ? "Tu cuenta" : "—"}
                    </span>
                  );
                },
              },
            ]}
          />
        </section>
      )}

      {OPS_TABS.has(tab) && (
        <PermisionarioPanel activeTab={tab} onTabChange={setTab} />
      )}

      {tab === "tarifas" && <TariffManager />}
    </AppShell>
  );
}
