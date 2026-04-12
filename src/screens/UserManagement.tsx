import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Search, Trash2, ChevronRight, Info } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";

export default function UserManagement() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const users = [
    { id: 1, name: "Juan Pérez", initials: "JP", date: "12/05/2026", count: 24, note: "Administrador de Sistemas", active: true, color: "text-dg-accent" },
    { id: 2, name: "María López", initials: "ML", date: "18/06/2026", count: 42, note: "Seguridad Nivel 2", active: true, color: "text-blue-400" },
    { id: 3, name: "Carlos Díaz", initials: "CD", date: "02/08/2026", count: 12, note: "Personal de Mantenimiento", active: true, color: "text-purple-400" },
    { id: 4, name: "Ana Torres", initials: "AT", date: "15/09/2026", count: 31, note: "Auditoría Interna", active: true, color: "text-pink-400" },
    { id: 5, name: "Pedro Martínez", initials: "PM", date: "15/01/2026", count: 0, note: "Cuenta deshabilitada por vacaciones", active: false, color: "text-dg-text-muted" },
  ];

  const filteredUsers = useMemo(() => {
    return users.filter(user => 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.note.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  return (
    <div className="min-h-screen pb-24 flex flex-col">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-dg-accent" />
              <h1 className="text-xl font-bold tracking-tight font-headline">Usuarios</h1>
            </div>
            <button 
              onClick={() => navigate("/register/start")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-dg-accent text-dg-bg text-sm font-bold shadow-[0_0_15px_rgba(163,255,0,0.3)] active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" /> Registrar
            </button>
          </div>
          
          <div className="px-4 pb-4 space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dg-text-muted w-4 h-4" />
              <input 
                type="text" 
                placeholder="Buscar usuario..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-dg-card border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-dg-accent/50 placeholder:text-dg-text-muted text-white"
              />
            </div>
            
            <div className="bg-dg-card/50 border border-dg-border rounded-xl p-3 flex justify-around text-center max-w-2xl">
              <div>
                <p className="text-dg-accent font-bold text-sm">8</p>
                <p className="text-[9px] text-dg-text-muted uppercase tracking-wider">Registrados</p>
              </div>
              <div className="w-[1px] bg-dg-border" />
              <div>
                <p className="text-white font-bold text-sm">156</p>
                <p className="text-[9px] text-dg-text-muted uppercase tracking-wider">Accesos</p>
              </div>
              <div className="w-[1px] bg-dg-border" />
              <div>
                <p className="text-white font-bold text-sm flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-dg-accent animate-pulse" /> 5 / 3
                </p>
                <p className="text-[9px] text-dg-text-muted uppercase tracking-wider">Activos / Inactivos</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3 max-w-7xl mx-auto w-full">
        <div className="text-xs font-bold text-dg-text-muted uppercase tracking-wider mb-2">Personal Autorizado</div>
        
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`cyber-card p-4 flex items-center gap-4 shadow-sm ${!user.active ? 'opacity-50' : ''}`}
            >
              <div className={`w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0`}>
                <span className={`font-bold text-sm ${user.color}`}>{user.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-white truncate flex items-center gap-1.5">
                    <span className={`text-[10px] ${user.active ? 'text-dg-accent' : 'text-dg-text-muted'}`}>●</span> {user.name}
                  </h3>
                  <button 
                    onClick={() => navigate("/users/delete/confirm")}
                    className="text-dg-error/50 hover:text-dg-error transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-dg-text-muted truncate">Registrado: {user.date} • {user.count} accesos</p>
                <p className="text-[10px] text-dg-text-muted/60 italic truncate">Nota: {user.note}</p>
                <button 
                  onClick={() => navigate("/profile/juan")}
                  className="mt-2 text-xs font-bold text-dg-accent flex items-center gap-1"
                >
                  Ver perfil <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-12 text-dg-text-muted">
            <p className="text-sm">No se encontraron usuarios que coincidan con "{searchQuery}"</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 py-6 text-dg-text-muted text-xs">
          <Info className="w-4 h-4" />
          {filteredUsers.length} usuarios mostrados
        </div>
      </main>

      <Navigation />
    </div>
  );
}
