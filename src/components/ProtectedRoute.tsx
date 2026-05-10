import type React from "react";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { getSessionActual } from "../lib/supabase";

/**
 * Componente que protege rutas autenticadas.
 * Verifica la sesión de Supabase Auth + flag localStorage.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    async function verificar() {
      // Verificar flag rápido (evita flash)
      const flag = localStorage.getItem("dg_admin");
      if (!flag) {
        setAuthenticated(false);
        setChecking(false);
        return;
      }

      // Verificar sesión real con Supabase Auth
      const session = await getSessionActual();
      if (!session) {
        // Sesión expirada — limpiar flag
        localStorage.removeItem("dg_admin");
        setAuthenticated(false);
      } else {
        setAuthenticated(true);
      }
      setChecking(false);
    }
    verificar();
  }, []);

  if (checking) {
    // Spinner mínimo mientras verifica
    return (
      <div className="min-h-screen bg-dg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-dg-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
