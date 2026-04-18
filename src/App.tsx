import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
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
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/live" element={<LiveMonitor />} />
        <Route path="/history" element={<History />} />
        <Route path="/users" element={<UserManagement />} />
        <Route path="/event/:id" element={<EventDetail />} />
        <Route path="/profile/:id" element={<UserProfile />} />
        <Route path="/users/edit/:id" element={<EditUserModal />} />
        <Route path="/users/delete/:id" element={<DeleteConfirmModal />} />
        <Route path="/register/start" element={<RegisterStart />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}
