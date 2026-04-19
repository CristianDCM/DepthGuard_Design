import { Navigate } from "react-router-dom";

/**
 * Componente que protege rutas autenticadas.
 * Si no hay sesión de admin en localStorage, redirige al login.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const admin = localStorage.getItem("dg_admin");

  if (!admin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
