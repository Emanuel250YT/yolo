import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { DevToolsProvider } from "./dev/DevToolsContext";
import { DevToolsPanel } from "./dev/DevToolsPanel";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { PermisionarioDashboard } from "./pages/PermisionarioDashboard";
import { ConductorDashboard } from "./pages/ConductorDashboard";
import { MunicipioDashboard } from "./pages/MunicipioDashboard";
function RoleHome() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="boot">
        <p>Cargando sesión…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case "municipio":
      return <MunicipioDashboard />;
    case "admin":
      return <AdminDashboard />;
    case "permisionario":
      return <PermisionarioDashboard />;
    case "conductor":
      return <ConductorDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot"><p>Cargando…</p></div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <DevToolsProvider>
        <BrowserRouter>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicOnly>
                  <LoginPage />
                </PublicOnly>
              }
            />
            <Route
              path="/registro"
              element={
                <PublicOnly>
                  <RegisterPage />
                </PublicOnly>
              }
            />
            <Route path="/" element={<RoleHome />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <DevToolsPanel />
        </BrowserRouter>
      </DevToolsProvider>
    </AuthProvider>
  );
}
