import { useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext";
import { AppFooter } from "./AppFooter";
import { BrandLogo } from "./BrandLogo";
import type { UserRole } from "../types";

export interface NavItem {
  id: string;
  label: string;
}

export interface MobileDockConfig {
  left: {
    tabId: string;
    label: string;
    badge?: number;
  };
  center: {
    tabId: string;
    label: string;
  };
  right: {
    label: string;
    action: "menu";
  };
}

interface AppShellProps {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  tab: string;
  onTab: (id: string) => void;
  wide?: boolean;
  mobileDock?: MobileDockConfig;
  children: ReactNode;
}

const ROLE_LABELS: Record<UserRole, string> = {
  municipio: "Municipalidad",
  admin: "Administrador",
  permisionario: "Permisionario",
  conductor: "Conductor",
};

function IconPlazas() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
      />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        d="M12 5v14M5 12h14"
      />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
      <path
        fill="currentColor"
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5z"
      />
    </svg>
  );
}

export function AppShell({
  title,
  subtitle,
  nav,
  tab,
  onTab,
  wide = false,
  mobileDock,
  children,
}: AppShellProps) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const activeNav = nav.find((item) => item.id === tab);
  const headerTitle = activeNav?.label ?? title;

  function goTab(id: string) {
    onTab(id);
    setMenuOpen(false);
  }

  return (
    <div className="shell">
      <header className="mobile-top-bar">
        <div className="mobile-top-brand">
          <BrandLogo variant="icon" size="xs" className="brand-icon" />
          <div className="mobile-top-titles">
            <strong>{headerTitle}</strong>
            <span>{ROLE_LABELS[user!.role]}</span>
          </div>
        </div>
        <button
          type="button"
          className="mobile-top-profile"
          aria-label="Abrir menú y perfil"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <IconUser />
        </button>
      </header>

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
          <BrandLogo variant="icon" size="xs" className="brand-icon" />
          <div>
            <strong>SEM</strong>
            <span>
              Salta · {ROLE_LABELS[user!.role]}
            </span>
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
              onClick={() => goTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <AppFooter dark />
          <button type="button" className="btn-logout" onClick={logout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className={`main ${wide ? "main--wide" : ""}`}>
        <header className="page-header page-header--desktop">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </header>
        {children}
        <AppFooter className="app-footer--desktop" />
      </main>

      {mobileDock && (
        <nav className="mobile-dock" aria-label="Accesos rápidos">
          <button
            type="button"
            className={
              tab === mobileDock.left.tabId
                ? "mobile-dock-item active"
                : "mobile-dock-item"
            }
            onClick={() => goTab(mobileDock.left.tabId)}
          >
            <span className="mobile-dock-icon">
              <IconPlazas />
              {mobileDock.left.badge != null && mobileDock.left.badge > 0 && (
                <span className="mobile-dock-badge">{mobileDock.left.badge}</span>
              )}
            </span>
            <span className="mobile-dock-label">{mobileDock.left.label}</span>
          </button>

          <button
            type="button"
            className={
              tab === mobileDock.center.tabId
                ? "mobile-dock-item mobile-dock-item--primary active"
                : "mobile-dock-item mobile-dock-item--primary"
            }
            onClick={() => goTab(mobileDock.center.tabId)}
            aria-label={mobileDock.center.label}
          >
            <span className="mobile-dock-primary-btn">
              <IconPlus />
            </span>
            <span className="mobile-dock-label mobile-dock-label--primary">
              {mobileDock.center.label}
            </span>
          </button>

          <button
            type="button"
            className="mobile-dock-item"
            onClick={() => setMenuOpen(true)}
          >
            <span className="mobile-dock-icon">
              <IconUser />
            </span>
            <span className="mobile-dock-label">{mobileDock.right.label}</span>
          </button>
        </nav>
      )}
    </div>
  );
}
