import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./screens/Login";
import Dashboard from "./screens/Dashboard";
import LiveMonitor from "./screens/LiveMonitor";
import History from "./screens/History";
import UserManagement from "./screens/UserManagement";
import EventDetail from "./screens/EventDetail";
import FraudDetail from "./screens/FraudDetail";
import UnknownDetail from "./screens/UnknownDetail";
import UserProfile from "./screens/UserProfile";
import EditUserModal from "./screens/EditUserModal";
import RegisterStart from "./screens/RegisterStart";
import Settings from "./screens/Settings";
import DeleteConfirmModal from "./screens/DeleteConfirmModal";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/live" element={<LiveMonitor />} />
        <Route path="/history" element={<History />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/event/authorized" element={<EventDetail />} />
        <Route path="/event/fraud" element={<FraudDetail />} />
        <Route path="/event/unknown" element={<UnknownDetail />} />
        <Route path="/profile/juan" element={<UserProfile />} />
        <Route path="/users/edit" element={<EditUserModal />} />
        <Route path="/users/delete/confirm" element={<DeleteConfirmModal />} />
        <Route path="/register/start" element={<RegisterStart />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}
