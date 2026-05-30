import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { api, setToken } from "../api/client";
import { useDevTools } from "../dev/DevToolsContext";
import { ConfirmModal } from "./ConfirmModal";

export function DatabaseCleanPanel() {
  const { enabled, ready, clientEnabled, serverEnabled } = useDevTools();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
    setError(null);
    setMessage(null);
    try {
      const res = await api.adminCleanDatabase();
      const parts = Object.entries(res.result)
        .filter(([, n]) => n > 0)
        .map(([k, n]) => `${k}: ${n}`)
        .join(", ");
      setMessage(
        parts ? `${res.message} (${parts})` : res.message,
      );
      if (user?.role !== "municipio") {
        setToken(null);
        logout();
        window.location.href = "/login";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al limpiar");
    } finally {
      setLoading(false);
      setConfirmOpen(false);
    }
  }

  return (
    <section className="panel panel-danger-outline">
      <h2>Limpieza de base de datos</h2>
      <p className="panel-desc">
        Vacía zonas, plazas, permisos, reservas, sesiones, historial y demás
        usuarios. La cuenta <strong>Municipalidad</strong> (.env) se conserva y
        se re-sincroniza automáticamente. Solo con DevTools activo.
      </p>
      {message && <p className="form-success banner-success">{message}</p>}
      {error && <p className="form-error banner-error">{error}</p>}
      <button
        type="button"
        className="btn-small btn-danger"
        disabled={loading}
        onClick={() => setConfirmOpen(true)}
      >
        {loading ? "Limpiando…" : "Vaciar base de datos"}
      </button>

      {confirmOpen && (
        <ConfirmModal
          open
          title="Vaciar base de datos"
          variant="error"
          message="Se eliminarán todos los datos operativos y el resto de usuarios. La cuenta Municipalidad del .env se conservará. Si no sos Municipalidad, tu sesión se cerrará. Esta acción no se puede deshacer."
          confirmLabel="Sí, vaciar todo"
          cancelLabel="Cancelar"
          onConfirm={() => void runClean()}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </section>
  );
}
