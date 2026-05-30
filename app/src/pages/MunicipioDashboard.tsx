import { useCallback, useState } from "react";
import { api, unwrapPaginated } from "../api/client";
import { AccountProfilePanel } from "../components/AccountProfilePanel";
import { AppShell } from "../components/AppShell";
import { DashboardSummary } from "../components/DashboardSummary";
import { ParkingZoneManager } from "../components/ParkingZoneManager";
import { DataTable, RefCell } from "../components/DataTable";
import { PermisionarioPanel } from "../components/PermisionarioPanel";
import { SpotBlockManager } from "../components/SpotBlockManager";
import { TariffManager } from "../components/TariffManager";
import { UsersManager } from "../components/UsersManager";
import { usePaginatedTable } from "../hooks/usePaginatedTable";
import { useSubmitLock } from "../hooks/useSubmitLock";
import { useToast } from "../components/Toast";
import type { User } from "../types";
import { formatRef } from "../utils/formatRef";

const NAV = [
  { id: "resumen", label: "Resumen" },
  { id: "pendientes", label: "Pendientes" },
  { id: "zonas", label: "Zonas" },
  { id: "usuarios", label: "Usuarios" },
  { id: "permisos", label: "Permisos" },
  { id: "nuevo", label: "Nuevo permiso" },
  { id: "plazas", label: "Plazas" },
  { id: "historial", label: "Historial" },
  { id: "tarifas", label: "Tarifas" },
  { id: "cuenta", label: "Mi cuenta" },
];

const OPS_TABS = new Set(["permisos", "nuevo", "historial"]);

export function MunicipioDashboard() {
  const [tab, setTab] = useState("resumen");
  const toast = useToast();
  const { busy: activating, run: runActivate } = useSubmitLock();
  const fetchDashboard = useCallback(() => api.municipioDashboard(), []);

  const { items: pending, serverPagination, refresh } =
    usePaginatedTable<User>({
      fetchPage: async ({ page, pageSize, q }) =>
        unwrapPaginated(
          "users",
          await api.municipioPendingUsers({ page, pageSize, q }),
        ),
      enabled: tab === "pendientes",
    });

  async function activate(id: string) {
    await runActivate(async () => {
      try {
        const res = await api.municipioActivateUser(id);
        toast.success(res.message);
        await refresh();
        setTab("usuarios");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error");
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
      {tab === "resumen" && (
        <DashboardSummary fetchStats={fetchDashboard} showPendingUsers />
      )}

      {tab === "zonas" && <ParkingZoneManager apiMode="municipio" />}

      {tab === "pendientes" && (
        <section className="panel">
          <h2>Solicitudes pendientes</h2>
          <p className="panel-desc">
            Cuentas registradas que esperan habilitación. Para altas nuevas con
            todos los roles usá la pestaña Usuarios.
          </p>
          <DataTable
            rows={pending}
            rowKey={(u) => u.id}
            searchPlaceholder="Buscar por ID, nombre, email…"
            emptyMessage="No hay cuentas pendientes de habilitación."
            serverPagination={serverPagination}
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

      {tab === "usuarios" && <UsersManager apiMode="municipio" />}

      {tab === "plazas" && <SpotBlockManager apiMode="municipio" />}

      {OPS_TABS.has(tab) && (
        <PermisionarioPanel activeTab={tab} onTabChange={setTab} />
      )}

      {tab === "tarifas" && <TariffManager />}

      {tab === "cuenta" && <AccountProfilePanel />}
    </AppShell>
  );
}
