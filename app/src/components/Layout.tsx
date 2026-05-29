import type { ReactNode } from "react";
import type { TabId } from "../types";

const TABS: { id: TabId; label: string }[] = [
  { id: "inicio", label: "Inicio" },
  { id: "estacionar", label: "Estacionar" },
  { id: "cotizar", label: "Cotizar" },
  { id: "activas", label: "Activas" },
];

interface LayoutProps {
  tab: TabId;
  onTab: (tab: TabId) => void;
  connected: boolean | null;
  children: ReactNode;
}

export function Layout({ tab, onTab, connected, children }: LayoutProps) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">SEM</span>
          <div>
            <strong>Salta</strong>
            <span>Estacionamiento Medido</span>
          </div>
        </div>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? "nav-item active" : "nav-item"}
              onClick={() => onTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span
            className={
              connected === null
                ? "status-pill"
                : connected
                  ? "status-pill ok"
                  : "status-pill err"
            }
          >
            {connected === null
              ? "Conectando…"
              : connected
                ? "API conectada"
                : "API sin conexión"}
          </span>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
