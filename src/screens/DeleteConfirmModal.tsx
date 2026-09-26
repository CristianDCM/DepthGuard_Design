import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center bg-dg-canvas/80">
        <p role="status" className="text-xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Cargando</p>
      </div>
    );
  }

  const initials = user?.nombre?.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() ?? "??";

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-dg-canvas/80 relative overflow-hidden">
      {/* Se retira el decorado de fondo: dos tarjetas falsas desenfocadas
          imitando una lista que no esta ahi. */}
      <div className="relative z-50 w-full max-w-[340px] border border-dg-border bg-dg-bg p-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center border border-dg-error/50">
            <AlertTriangle className="h-9 w-9 text-dg-error" aria-hidden="true" />
          </div>
          
          <h1 className="mb-3 text-xl font-bold uppercase tracking-[0.8px] text-dg-text">¿Eliminar usuario?</h1>
          
          <p className="text-dg-text-secondary text-sm leading-relaxed mb-6 px-2">
            Se borrará su plantilla facial y su registro. Dejará de tener acceso
            de inmediato.
            <span className="text-dg-error font-semibold block mt-1">Esta acción no se puede deshacer.</span>
          </p>

          <div className="mb-8 flex w-full items-center gap-3 border border-dg-border p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-dg-border">
              <span className="text-dg-text-secondary font-bold text-sm">{initials}</span>
            </div>
            <div className="text-left overflow-hidden">
              <h3 className="font-bold text-dg-text text-sm truncate">{user?.nombre ?? "—"}</h3>
              <p className="text-2xs font-medium uppercase tracking-[0.8px] text-dg-text-muted">ID #{id?.substring(0, 8)}</p>
            </div>
          </div>

          <div className="flex flex-col w-full gap-3">
            <button 
              onClick={handleDelete}
              disabled={deleting}
              className="flex w-full items-center justify-center gap-2 border border-dg-error bg-dg-error py-3.5 text-sm font-bold uppercase tracking-[0.8px] text-dg-bg hover:brightness-110 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> {deleting ? "Eliminando" : "Eliminar"}
            </button>
            <button 
              onClick={() => navigate(-1)}
              className="btn w-full py-3.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
