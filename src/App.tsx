import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./screens/Login";
import SetPassword from "./screens/SetPassword";
import Dashboard from "./screens/Dashboard";
import LiveMonitor from "./screens/LiveMonitor";
import History from "./screens/History";
import UserManagement from "./screens/UserManagement";
import EventDetail from "./screens/EventDetail";
import UserProfile from "./screens/UserProfile";
import EditUserModal from "./screens/EditUserModal";
import RegisterStart from "./screens/RegisterStart";
import Settings from "./screens/Settings";
import DeleteConfirmModal from "./screens/DeleteConfirmModal";

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
function InviteRedirect({ children }: { children: React.ReactNode }) {
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

export default function App() {
  return (
    <Router>
      <InviteRedirect>
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
        </Routes>
      </InviteRedirect>
    </Router>
  );
}
