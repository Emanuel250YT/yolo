import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { PermisionarioPanel } from "../components/PermisionarioPanel";

const NAV = [
  { id: "permisos", label: "Permisos" },
  { id: "nuevo", label: "Nuevo permiso" },
  { id: "plazas", label: "Plazas" },
  { id: "historial", label: "Historial" },
];

export function PermisionarioDashboard() {
  const [tab, setTab] = useState("permisos");

  return (
    <AppShell
      title="Panel permisionario"
      subtitle="Permisos, observaciones y modificaciones con historial"
      nav={NAV}
      tab={tab}
      onTab={setTab}
      mobileDock={{
        left: { tabId: "plazas", label: "Plazas" },
        center: { tabId: "nuevo", label: "Nuevo permiso" },
        right: { action: "menu", label: "Mi perfil" },
      }}
    >
      <PermisionarioPanel activeTab={tab} onTabChange={setTab} />
    </AppShell>
  );
}
