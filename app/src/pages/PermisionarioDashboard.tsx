import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { PermisionarioPanel } from "../components/PermisionarioPanel";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/Toast";

const NAV = [
  { id: "control", label: "Control" },
  { id: "permisos", label: "Permisos" },
  { id: "nuevo", label: "Nuevo permiso" },
  { id: "plazas", label: "Plazas" },
  { id: "historial", label: "Historial" },
  { id: "cuenta", label: "Mi cuenta" },
];

export function PermisionarioDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "permisos";
  const [tab, setTab] = useState(initialTab);
  const { refreshUser } = useAuth();
  const toast = useToast();
  const handledMp = useRef(false);

  useEffect(() => {
    const mp = searchParams.get("mp");
    if (!mp || handledMp.current) return;
    handledMp.current = true;

    if (mp === "linked") {
      void refreshUser();
      toast.success("Mercado Pago vinculado correctamente.");
      setTab("cuenta");
    } else if (mp === "error") {
      const reason = searchParams.get("reason");
      toast.error(
        reason
          ? `No se pudo vincular Mercado Pago: ${decodeURIComponent(reason)}`
          : "No se pudo vincular Mercado Pago.",
      );
      setTab("cuenta");
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, refreshUser, toast]);

  function handleTabChange(next: string) {
    setTab(next);
  }

  return (
    <AppShell
      title="Panel permisionario"
      subtitle="Permisos, observaciones y modificaciones con historial"
      nav={NAV}
      tab={tab}
      onTab={handleTabChange}
      mobileDock={{
        left: { tabId: "control", label: "Control" },
        center: { tabId: "nuevo", label: "Nuevo permiso" },
        right: { action: "menu", label: "Mi perfil" },
      }}
    >
      <PermisionarioPanel activeTab={tab} onTabChange={handleTabChange} />
    </AppShell>
  );
}
