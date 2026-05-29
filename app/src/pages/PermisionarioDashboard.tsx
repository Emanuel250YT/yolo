import { useState } from "react";
import { AppShell } from "../components/AppShell";
import { PermisionarioPanel } from "../components/PermisionarioPanel";

const NAV = [
  { id: "permisos", label: "Permisos" },
  { id: "nuevo", label: "Nuevo permiso" },
  { id: "historial", label: "Historial" },
  { id: "sesiones", label: "Sesiones" },
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
    >
      <PermisionarioPanel activeTab={tab} />
    </AppShell>
  );
}
