import { useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../types";

export interface NavItem {
  id: string;
  label: string;
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  tab: string;
  onTab: (id: string) => void;
  children: ReactNode;
}

const ROLE_LABELS: Record<UserRole, string> = {
  municipio: "Municipalidad",
  admin: "Administrador",
  permisionario: "Permisionario",
  conductor: "Conductor",
};

export function AppShell({
  title,
  subtitle,
  nav,
  tab,
  onTab,
  children,
}: AppShellProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="shell">
      <button
        type="button"
        className="menu-toggle"
        aria-label="Abrir menú"
        onClick={() => setMenuOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>

      {menuOpen && (
        <button
          type="button"
          className="menu-overlay"
          aria-label="Cerrar menú"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">SEM</span>
          <div>
            <strong>Salta</strong>
            <span>{ROLE_LABELS[user!.role]}</span>
          </div>
        </div>

        <div className="user-chip">
          <span className="user-name">{user!.name}</span>
          <span className="user-email">{user!.email}</span>
          {user!.legajo && (
            <span className="user-meta">Legajo {user!.legajo}</span>
          )}
        </div>

        <nav>
          {nav.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "nav-item active" : "nav-item"}
              onClick={() => {
                onTab(item.id);
                setMenuOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <button type="button" className="btn-logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="page-header">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
