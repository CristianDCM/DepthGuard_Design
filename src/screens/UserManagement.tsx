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
              <Users className="w-6 h-6 text-dg-text-secondary" aria-hidden="true" />
              <h1 className="text-xl font-bold tracking-tight font-headline">Usuarios</h1>
            </div>
            <button 
              onClick={() => navigate("/register/start")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-dg bg-dg-action text-white text-sm font-semibold hover:bg-dg-action-hover active:scale-[0.98] transition-colors"
            >
              <Plus className="w-4 h-4" /> Registrar
            </button>
          </div>
          
          <div className="px-4 pb-4 space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dg-text-muted w-4 h-4" />
              <input 
                id="buscar-usuario"
                type="search"
                aria-label="Buscar usuario por nombre"
                placeholder="Buscar usuario..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-dg-card border border-dg-border rounded-dg py-2.5 pl-10 pr-4 text-sm focus:border-dg-focus transition-colors placeholder:text-dg-text-muted text-dg-text"
              />
            </div>
            
            <div className="bg-dg-card/50 border border-dg-border rounded-dg p-3 flex justify-around text-center max-w-2xl">
              <div>
                <p className="text-dg-text font-bold text-sm">{users.length}</p>
                <p className="text-[10px] text-dg-text-muted uppercase tracking-wider">Registrados</p>
              </div>
              <div className="w-[1px] bg-dg-border" />
              <div>
                <p className="text-dg-text font-bold text-sm">{totalAccesos}</p>
                <p className="text-[10px] text-dg-text-muted uppercase tracking-wider">Accesos</p>
              </div>
              <div className="w-[1px] bg-dg-border" />
              <div>
                <p className="text-dg-text font-bold text-sm flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-dg-success animate-pulse" aria-hidden="true" /> {estadoCount.activos} / {estadoCount.inactivos}
                </p>
                <p className="text-[10px] text-dg-text-muted uppercase tracking-wider">Activos / Inactivos</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3 max-w-7xl mx-auto w-full">
        <div className="text-xs font-bold text-dg-text-muted uppercase tracking-wider mb-2">Personal Autorizado</div>
        
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-dg-info border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredUsers.length > 0 ? (
          // En escritorio la lista pasa a rejilla: en una sola columna las
          // tarjetas se estiraban a todo el ancho y desperdiciaban la pantalla.
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredUsers.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`cyber-card p-4 flex items-center gap-4 shadow-sm ${!user.activo ? 'opacity-50' : ''}`}
            >
              <div className="w-12 h-12 rounded-full bg-dg-input border border-dg-border flex items-center justify-center shrink-0">
                <span className={`font-bold text-sm ${user.activo ? 'text-dg-text-secondary' : 'text-dg-text-off'}`}>
                  {getInitials(user.nombre)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-dg-text truncate flex items-center gap-1.5">
                    <span className={`text-[10px] ${user.activo ? 'text-dg-success' : 'text-dg-text-muted'}`}>●</span> {user.nombre}
                  </h3>
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/users/delete/${user.id}`); }}
                    aria-label={`Eliminar a ${user.nombre}`}
                    className="text-dg-error/50 hover:text-dg-error transition-colors"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-xs text-dg-text-muted truncate">Registrado: {formatDate(user.fecha_registro)} • {user.num_angulos} ángulos</p>
                {user.notas && <p className="text-[10px] text-dg-text-muted/60 italic truncate">Nota: {user.notas}</p>}
                <button 
                  onClick={() => navigate(`/profile/${user.id}`)}
                  className="mt-2 text-xs font-bold text-dg-action-text flex items-center gap-1"
                >
                  Ver perfil <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
            ))}
          </div>
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
