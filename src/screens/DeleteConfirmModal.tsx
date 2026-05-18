import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { getUsuarioPorId, eliminarUsuario, type Usuario } from "../lib/supabase";

export default function DeleteConfirmModal() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<Usuario | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      if (!id) return;
      try {
        const data = await getUsuarioPorId(id);
        setUser(data);
      } catch (err) {
        console.error("Error cargando usuario:", err);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [id]);

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await eliminarUsuario(id);
      navigate("/users");
    } catch (err) {
      console.error("Error eliminando:", err);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/60">
        <div className="w-8 h-8 border-2 border-dg-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const initials = user?.nombre?.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() ?? "??";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm relative overflow-hidden">
      {/* Background content (simulated) */}
      <div className="absolute inset-0 opacity-20 blur-sm pointer-events-none">
        <div className="p-4 space-y-4">
          <div className="cyber-card h-20 w-full" />
          <div className="cyber-card h-20 w-full" />
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-dg-card w-full max-w-[340px] rounded-2xl p-6 border border-dg-border shadow-2xl relative z-50"
      >
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-dg-error/10 flex items-center justify-center mb-5">
            <AlertTriangle className="w-10 h-10 text-dg-error fill-dg-error/10" />
          </div>
          
          <h2 className="text-xl font-bold text-white mb-3 font-headline">¿Eliminar usuario?</h2>
          
          <p className="text-dg-text-muted text-xs leading-relaxed mb-6 px-2">
            Se eliminarán sus datos biométricos (embeddings faciales) y su registro del sistema. 
            <span className="text-dg-error font-semibold block mt-1">Esta acción no se puede deshacer.</span>
          </p>

          <div className="w-full bg-dg-bg border border-dg-border rounded-xl p-3 flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-dg-accent/10 border border-dg-accent/20 flex items-center justify-center shrink-0">
              <span className="text-dg-accent font-bold text-sm">{initials}</span>
            </div>
            <div className="text-left overflow-hidden">
              <h3 className="font-bold text-white text-sm truncate">{user?.nombre ?? "—"}</h3>
              <p className="text-[10px] text-dg-text-muted font-medium">ID #{id?.substring(0, 8)}</p>
            </div>
          </div>

          <div className="flex flex-col w-full gap-3">
            <button 
              onClick={handleDelete}
              disabled={deleting}
              className="w-full py-3.5 bg-dg-error text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> {deleting ? "Eliminando..." : "Eliminar"}
            </button>
            <button 
              onClick={() => navigate(-1)}
              className="w-full py-3.5 bg-dg-bg text-dg-text-muted font-bold rounded-xl border border-dg-border hover:text-white hover:bg-dg-border transition-all active:scale-95"
            >
              Cancelar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
