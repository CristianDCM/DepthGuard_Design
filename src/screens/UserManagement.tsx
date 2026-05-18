import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Search, Trash2, ChevronRight, Info } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";
import { getUsuarios, contarUsuariosPorEstado, contarTotalAccesos, type Usuario } from "../lib/supabase";

export default function UserManagement() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<Usuario[]>([]);
  const [estadoCount, setEstadoCount] = useState({ activos: 0, inactivos: 0 });
  const [totalAccesos, setTotalAccesos] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const [usuarios, estados, accesos] = await Promise.all([
          getUsuarios(),
          contarUsuariosPorEstado(),
          contarTotalAccesos(),
        ]);
        setUsers(usuarios);
        setEstadoCount(estados);
        setTotalAccesos(accesos);
      } catch (err) {
        console.error("Error cargando usuarios:", err);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  const filteredUsers = users.filter(user =>
    user.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.notas ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const colors = ["text-dg-accent", "text-blue-400", "text-purple-400", "text-pink-400", "text-cyan-400", "text-orange-400"];

  function getInitials(nombre: string) {
    return nombre.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  }

  function formatDate(fecha: string) {
    return new Date(fecha).toLocaleDateString("es", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  return (
    <div className="min-h-screen pb-24 flex flex-col">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-dg-accent" />
              <h1 className="text-xl font-bold font-headline">Usuarios</h1>
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
                <p className="text-dg-accent font-bold text-sm">{users.length}</p>
                <p className="text-[9px] text-dg-text-muted">Registrados</p>
              </div>
              <div className="w-[1px] bg-dg-border" />
              <div>
                <p className="text-white font-bold text-sm">{totalAccesos}</p>
                <p className="text-[9px] text-dg-text-muted">Accesos</p>
              </div>
              <div className="w-[1px] bg-dg-border" />
              <div>
                <p className="text-white font-bold text-sm flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-dg-accent animate-pulse" /> {estadoCount.activos} / {estadoCount.inactivos}
                </p>
                <p className="text-[9px] text-dg-text-muted">Activos / Inactivos</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3 max-w-7xl mx-auto w-full">
        <div className="text-xs font-bold text-dg-text-muted mb-2">Personal Autorizado</div>
        
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-dg-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredUsers.length > 0 ? (
          filteredUsers.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`cyber-card p-4 flex items-center gap-4 shadow-sm ${!user.activo ? 'opacity-50' : ''}`}
            >
              <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <span className={`font-bold text-sm ${user.activo ? colors[index % colors.length] : 'text-dg-text-muted'}`}>
                  {getInitials(user.nombre)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-white truncate flex items-center gap-1.5">
                    <span className={`text-[10px] ${user.activo ? 'text-dg-accent' : 'text-dg-text-muted'}`}>●</span> {user.nombre}
                  </h3>
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/users/delete/${user.id}`); }}
                    className="text-dg-error/50 hover:text-dg-error transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-dg-text-muted truncate">Registrado: {formatDate(user.fecha_registro)} • {user.num_angulos} ángulos</p>
                {user.notas && <p className="text-[10px] text-dg-text-muted/60 italic truncate">Nota: {user.notas}</p>}
                <button 
                  onClick={() => navigate(`/profile/${user.id}`)}
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
