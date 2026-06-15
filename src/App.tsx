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
 * El hash de autenticación (access_token, type=invite, etc.) es capturado
 * por un script inline en index.html ANTES de que Supabase JS lo consuma.
 * Se guarda en sessionStorage con la clave 'dg_auth_hash'.
 * 
 * Este componente lee ese valor guardado y redirige a /auth/callback
 * para que el usuario establezca su contraseña.
 */
function InviteRedirect({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  // Leer el hash capturado por el script inline de index.html
  const savedHash = sessionStorage.getItem("dg_auth_hash");

  if (location.pathname === "/" && savedHash) {
    // Limpiar para que no redirija en bucle
    sessionStorage.removeItem("dg_auth_hash");
    return <Navigate to="/auth/callback" replace />;
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
