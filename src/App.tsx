import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./screens/Login";
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

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Ruta pública */}
        <Route path="/" element={<Login />} />

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
    </Router>
  );
}
