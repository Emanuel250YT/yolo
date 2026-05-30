import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { AppShell } from "../components/AppShell";
import { DataTable, RefCell } from "../components/DataTable";
import { DashboardSummary } from "../components/DashboardSummary";
import { ParkingZoneManager } from "../components/ParkingZoneManager";
import { SpotBlockManager } from "../components/SpotBlockManager";
import { PermisionarioPanel } from "../components/PermisionarioPanel";
import { UsersManager } from "../components/UsersManager";
import type { Reservation } from "../types";
import { formatRef } from "../utils/formatRef";
import {
  ENTITY_TAB,
  setEntityNavHandler,
  type EntityNavTarget,
} from "../utils/entityNav";

const NAV = [
  { id: "resumen", label: "Resumen" },
  { id: "permisos", label: "Permisos" },
  { id: "nuevo", label: "Nuevo permiso" },
  { id: "historial", label: "Historial" },
  { id: "zonas", label: "Zonas" },
  { id: "plazas", label: "Plazas" },
  { id: "usuarios", label: "Usuarios" },
  { id: "reservas", label: "Reservas" },
];

const OPS_TABS = new Set(["permisos", "nuevo", "historial"]);

export function AdminDashboard() {
  const [tab, setTab] = useState("resumen");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [entityNav, setEntityNav] = useState<EntityNavTarget | null>(null);

  const fetchDashboard = useCallback(() => api.adminDashboard(), []);

  const handleEntityNav = useCallback((target: EntityNavTarget) => {
    setTab(ENTITY_TAB[target.kind] ?? "resumen");
    setEntityNav(target);
  }, []);

  useEffect(() => {
    setEntityNavHandler(handleEntityNav);
    return () => setEntityNavHandler(null);
  }, [handleEntityNav]);

  const clearEntityNav = useCallback(() => setEntityNav(null), []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api.adminReservations();
      setReservations(r.reservations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AppShell
      wide
      title="Administración SEM"
      subtitle="Gestión integral del sistema"
      nav={NAV}
      tab={tab}
      onTab={setTab}
      mobileDock={{
        left: { tabId: "resumen", label: "Resumen" },
        center: { tabId: "nuevo", label: "Nuevo permiso" },
        right: { action: "menu", label: "Menú" },
      }}
    >
      {error && <p className="form-error banner-error">{error}</p>}

      {tab === "resumen" && (
        <DashboardSummary fetchStats={fetchDashboard} />
      )}

      {OPS_TABS.has(tab) && (
        <PermisionarioPanel
          activeTab={tab}
          onTabChange={setTab}
          navTarget={entityNav}
          onNavHandled={clearEntityNav}
        />
      )}

      {tab === "zonas" && (
        <ParkingZoneManager
          navTarget={entityNav}
          onNavHandled={clearEntityNav}
        />
      )}

      {tab === "plazas" && (
        <SpotBlockManager
          navTarget={entityNav}
          onNavHandled={clearEntityNav}
        />
      )}

      {tab === "usuarios" && (
        <UsersManager navTarget={entityNav} onNavHandled={clearEntityNav} />
      )}

      {tab === "reservas" && (
        <section className="panel">
          <h2>Reservas conductores</h2>
          <DataTable
            rows={reservations}
            rowKey={(r) => r.id}
            searchPlaceholder="Buscar por ID, patente, plaza…"
            filters={[
              {
                key: "status",
                label: "Estado",
                options: [
                  { value: "confirmed", label: "Confirmada" },
                  { value: "cancelled", label: "Cancelada" },
                ],
              },
            ]}
            columns={[
              {
                key: "ref",
                header: "ID",
                searchValues: (r) => [r.ref, r.id, r.plate],
                render: (r) => <RefCell refId={formatRef(r)} entityKind="reservation" />,
              },
              {
                key: "spotRef",
                header: "ID plaza",
                searchValues: (r) => [r.spotRef, r.spotId, r.spotLabel],
                render: (r) =>
                  r.spotRef ? (
                    <RefCell refId={r.spotRef} entityKind="spot" />
                  ) : (
                    <span className="meta">—</span>
                  ),
              },
              {
                key: "plate",
                header: "Patente",
                searchValues: (r) => [r.plate, r.userName, r.userRef],
                render: (r) => r.plate,
              },
              {
                key: "userRef",
                header: "ID conductor",
                searchValues: (r) => [r.userRef, r.userId],
                render: (r) =>
                  r.userRef ? (
                    <RefCell refId={r.userRef} entityKind="user" />
                  ) : (
                    <span className="meta">—</span>
                  ),
              },
              {
                key: "spot",
                header: "Plaza",
                searchValues: (r) => [r.spotLabel, r.zone],
                render: (r) => r.spotLabel,
              },
              {
                key: "zone",
                header: "Zona",
                searchValues: (r) => [r.zone],
                render: (r) => r.zone,
              },
              {
                key: "zoneRef",
                header: "Cód. zona",
                render: (r) => <span className="chip">{r.zone}</span>,
              },
              {
                key: "amount",
                header: "Importe",
                render: (r) =>
                  `$${r.pricing.net.toLocaleString("es-AR")}`,
              },
              {
                key: "status",
                header: "Estado",
                filterKey: "status",
                searchValues: (r) => [r.status],
                render: (r) => r.status,
              },
              {
                key: "when",
                header: "Inicio",
                render: (r) =>
                  new Date(r.scheduledStart).toLocaleString("es-AR"),
              },
            ]}
          />
        </section>
      )}

    </AppShell>
  );
}
