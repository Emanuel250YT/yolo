import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import { AuthLayout } from "../components/AuthLayout";

const ROLE_LABELS: Record<string, string> = {
  permisionario: "permisionario",
  admin: "administrador",
  conductor: "conductor",
};

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inactiveNotice, setInactiveNotice] = useState<{
    message: string;
    role?: string;
    pending: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInactiveNotice(null);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.inactiveAccount) {
        setInactiveNotice({
          message: err.message,
          role: err.body.role,
          pending: Boolean(err.body.pendingActivation),
        });
      } else {
        setError(
          err instanceof ApiError ? err.message : "Error al iniciar sesión",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  const roleLabel = inactiveNotice?.role
    ? ROLE_LABELS[inactiveNotice.role] ?? inactiveNotice.role
    : null;

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Ingresá con tu correo y contraseña para acceder al sistema."
      alternate={{
        label: "¿No tenés cuenta?",
        to: "/registro",
        linkText: "Registrate aquí",
      }}
    >
      <form onSubmit={handleSubmit} className="form-standard">
        <div className="field">
          <label htmlFor="login-email">Correo electrónico</label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="nombre@ejemplo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="login-password">Contraseña</label>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {inactiveNotice && (
          <div className="inactive-banner" role="status">
            <strong>Cuenta inactiva</strong>
            <p>{inactiveNotice.message}</p>
            <p className="inactive-hint">
              Tus credenciales son correctas.
              {inactiveNotice.pending && roleLabel
                ? ` Tu alta como ${roleLabel} será completada por la Municipalidad; después podrás ingresar al sistema.`
                : " Contactá al SEM si necesitás ayuda."}
            </p>
          </div>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary btn-block" disabled={loading}>
          {loading ? "Ingresando…" : "Iniciar sesión"}
        </button>
      </form>
    </AuthLayout>
  );
}
