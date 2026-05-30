import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api, setToken } from "../api/client";
import { useDevTools } from "../dev/DevToolsContext";
import { useToast } from "./Toast";

export function DatabaseCleanPanel() {
  const { enabled, ready, clientEnabled, serverEnabled } = useDevTools();
  const { user, logout } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (!ready || !enabled) {
    if (!ready) return null;
    if (clientEnabled && !serverEnabled) {
      return (
        <section className="panel">
          <h2>Limpieza de base de datos</h2>
          <p className="panel-desc muted">
            Deshabilitada: el servidor no tiene{" "}
            <code>ENABLE_DEV_TOOLS=true</code> en backend/.env.
          </p>
        </section>
      );
    }
    return null;
  }

  async function runClean() {
    setLoading(true);
    try {
      const res = await api.adminCleanDatabase();
      const parts = Object.entries(res.result)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k}: ${n}`)
        .join(", ");
      toast.success(
        parts ? `${res.message} (${parts})` : res.message,
        "Base de datos vaciada",
      );
      if (user?.role !== "municipio") {
        setToken(null);
        logout();
        window.location.href = "/login";
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al limpiar");
    } finally {
      setLoading(false);
    }
  }

  async function askClean() {
    const ok = await toast.confirm({
      title: "Vaciar base de datos",
      message:
        "Se eliminarán todos los datos operativos y el resto de usuarios. La cuenta Municipalidad del .env se conservará. Si no sos Municipalidad, tu sesión se cerrará. Esta acción no se puede deshacer.",
      confirmLabel: "Sí, vaciar todo",
      variant: "error",
    });
    if (ok) void runClean();
  }

  return (
    <section className="panel panel-danger-outline">
      <h2>Limpieza de base de datos</h2>
      <p className="panel-desc">
        Vacía zonas, plazas, permisos, reservas, sesiones, historial y demás
        usuarios. La cuenta <strong>Municipalidad</strong> (.env) se conserva y
        se re-sincroniza automáticamente. Solo con DevTools activo.
      </p>
      <button
        type="button"
        className="btn-small btn-danger"
        disabled={loading}
        onClick={() => void askClean()}
      >
        {loading ? "Limpiando…" : "Vaciar base de datos"}
      </button>
    </section>
  );
}
