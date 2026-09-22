import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Search, Trash2, ChevronRight, Info } from "lucide-react";
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
    <div className="mini min-h-screen pb-24 lg:pb-0 lg:pt-16 flex flex-col">
      {/* Sin cabecera de titulo: la barra de navegacion ya dice donde
          estas. El <h1> se conserva para lectores de pantalla. */}
      <h1 className="sr-only">Usuarios registrados</h1>

      <main id="contenido" className="flex-1 px-4 py-4 space-y-4 max-w-7xl mx-auto w-full">
        {/* Buscador y alta, antes en la cabecera. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dg-text-muted w-4 h-4" aria-hidden="true" />
            <input 
              id="buscar-usuario"
              type="search"
              aria-label="Buscar usuario por nombre"
              placeholder="Buscar usuario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-dg-border bg-transparent py-2.5 pl-10 pr-4 text-base text-dg-text placeholder:text-dg-text-muted focus:border-dg-text"
            />
          </div>
          <button 
            onClick={() => navigate("/register/start")}
            className="mini-btn flex shrink-0 items-center justify-center gap-1.5 border-dg-text px-4 py-2.5 text-sm text-dg-text"
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> Registrar
          </button>
        </div>

        <div className="mini-card flex max-w-2xl justify-around p-3 text-center">
          <div>
            <p className="text-dg-text font-bold text-sm tabular">{users.length}</p>
            <p className="text-2xs uppercase tracking-[0.8px] text-dg-text-muted">Registrados</p>
          </div>
          <div className="w-[1px] bg-dg-border" />
          <div>
            <p className="text-dg-text font-bold text-sm tabular">{totalAccesos}</p>
            <p className="text-2xs uppercase tracking-[0.8px] text-dg-text-muted">Accesos</p>
          </div>
          <div className="w-[1px] bg-dg-border" />
          <div>
            <p className="text-dg-text font-bold text-sm flex items-center justify-center gap-1 tabular">
              {/* Punto cuadrado y quieto: antes latia en bucle. */}
              <span className="h-1.5 w-1.5 bg-dg-success" aria-hidden="true" /> {estadoCount.activos} / {estadoCount.inactivos}
            </p>
            <p className="text-2xs uppercase tracking-[0.8px] text-dg-text-muted">Activos / Inactivos</p>
          </div>
        </div>

        <div className="mb-2 text-xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Personal Autorizado</div>
        
        {loading ? (
          <p
            role="status"
            className="py-20 text-center text-xs font-bold uppercase tracking-[0.8px] text-dg-text-muted"
          >
            Cargando
          </p>
        ) : filteredUsers.length > 0 ? (
          // En escritorio la lista pasa a rejilla: en una sola columna las
          // tarjetas se estiraban a todo el ancho y desperdiciaban la pantalla.
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredUsers.map((user, index) => (
            <div
              key={user.id}
              className={`mini-card flex items-start gap-4 p-4 ${!user.activo ? 'opacity-50' : ''}`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-dg-border">
                <span className={`font-bold text-sm ${user.activo ? 'text-dg-text-secondary' : 'text-dg-text-off'}`}>
                  {getInitials(user.nombre)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className="flex min-w-0 items-center gap-2 truncate font-bold text-dg-text">
                    {/* El punto era el UNICO indicio de activo/inactivo, y el
                        color por si solo no informa a quien no lo distingue:
                        va acompanado de su etiqueta para lectores de pantalla. */}
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 shrink-0 ${user.activo ? 'bg-dg-success' : 'bg-dg-text-muted'}`}
                    />
                    <span className="sr-only">{user.activo ? 'Activo' : 'Inactivo'}: </span>
                    <span className="truncate">{user.nombre}</span>
                  </h3>
                  <button 
                    onClick={(e) => { e.stopPropagation(); navigate(`/users/delete/${user.id}`); }}
                    aria-label={`Eliminar a ${user.nombre}`}
                    className="shrink-0 text-dg-error/50 hover:text-dg-error"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="text-xs text-dg-text-muted truncate">Registrado: {formatDate(user.fecha_registro)} • {user.num_angulos} ángulos</p>
                {user.notas && <p className="text-2xs text-dg-text-muted/60 italic truncate">Nota: {user.notas}</p>}
                <button 
                  onClick={() => navigate(`/profile/${user.id}`)}
                  className="mt-2 flex items-center gap-1 text-xs font-bold uppercase tracking-[0.8px] text-dg-action-text"
                >
                  Ver perfil <ChevronRight className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-dg-text-muted">
            <p className="text-sm">No se encontraron usuarios que coincidan con "{searchQuery}"</p>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 py-6 text-xs uppercase tracking-[0.8px] text-dg-text-muted">
          <Info className="w-4 h-4" aria-hidden="true" />
          {filteredUsers.length} usuarios mostrados
        </div>
      </main>

      <Navigation variante="minimal" />
    </div>
  );
}
