import { Suspense, lazy, type ReactNode } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { MotionConfig } from "motion/react";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./screens/Login";
import SetPassword from "./screens/SetPassword";

// Carga diferida: cada pantalla viaja en su propio chunk y solo se
// descarga al navegar a ella. El login ya no arrastra Recharts ni
// el monitor en vivo.
const Dashboard = lazy(() => import("./screens/Dashboard"));
const LiveMonitor = lazy(() => import("./screens/LiveMonitor"));
const History = lazy(() => import("./screens/History"));
const UserManagement = lazy(() => import("./screens/UserManagement"));
const EventDetail = lazy(() => import("./screens/EventDetail"));
const UserProfile = lazy(() => import("./screens/UserProfile"));
const EditUserModal = lazy(() => import("./screens/EditUserModal"));
const RegisterStart = lazy(() => import("./screens/RegisterStart"));
const Settings = lazy(() => import("./screens/Settings"));
const DeleteConfirmModal = lazy(() => import("./screens/DeleteConfirmModal"));
const NotFound = lazy(() => import("./screens/NotFound"));

/**
 * Interceptor de tokens de invitación.
 * 
 * Cuando Supabase envía un correo de invitación, el enlace redirige a la
 * Site URL (raíz "/") con un hash como:
 *   /#access_token=xxx&type=invite
 * 
 * Este componente detecta ese hash ANTES de que el Login se renderice
 * y redirige automáticamente a /auth/callback donde SetPassword
 * procesa el token y permite establecer la contraseña.
 */
function InviteRedirect({ children }: { children: ReactNode }) {
  const location = useLocation();
  const hash = window.location.hash;

  // Detectar tokens de invitación o recuperación de contraseña en la URL
  if (
    location.pathname === "/" &&
    hash &&
    (hash.includes("type=invite") || hash.includes("type=recovery") || hash.includes("type=signup"))
  ) {
    // Redirigir a /auth/callback conservando el hash con el token
    return <Navigate to={"/auth/callback" + hash} replace />;
  }

  return <>{children}</>;
}

/** Indicador mientras se descarga el chunk de la pantalla solicitada. */
function PantallaCargando() {
  return (
    <div className="min-h-screen bg-dg-bg flex items-center justify-center">
      <div
        role="status"
        aria-label="Cargando"
        className="w-8 h-8 border-2 border-dg-info border-t-transparent rounded-full animate-spin"
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <Router>
          <InviteRedirect>
            <Suspense fallback={<PantallaCargando />}>
              <Routes>
                {/* Rutas públicas */}
                <Route path="/" element={<Login />} />
                <Route path="/auth/callback" element={<SetPassword />} />

                {/* Rutas protegidas — requieren login */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/live" element={<ProtectedRoute><LiveMonitor /></ProtectedRoute>} />
                <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
                <Route path="/event/:id" element={<ProtectedRoute><EventDetail /></ProtectedRoute>} />
                <Route path="/profile/:id" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                <Route path="/users/edit/:id" element={<ProtectedRoute><EditUserModal /></ProtectedRoute>} />
                <Route path="/users/delete/:id" element={<ProtectedRoute><DeleteConfirmModal /></ProtectedRoute>} />
                <Route path="/register/start" element={<ProtectedRoute><RegisterStart /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

                {/* 404 — cualquier ruta no reconocida */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </InviteRedirect>
        </Router>
      </MotionConfig>
    </ErrorBoundary>
  );
}
