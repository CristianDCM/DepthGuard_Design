import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Edit2, Save } from "lucide-react";
import { motion } from "motion/react";
import { getUsuarioPorId, actualizarUsuario, type Usuario } from "../lib/supabase";

export default function EditUserModal() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<Usuario | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      if (!id) return;
      try {
        const data = await getUsuarioPorId(id);
        setUser(data);
        setIsActive(data.activo);
        setNotas(data.notas ?? "");
      } catch (err) {
        console.error("Error cargando usuario:", err);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await actualizarUsuario(id, { activo: isActive, notas });
      navigate(`/profile/${id}`);
    } catch (err) {
      console.error("Error guardando:", err);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/60">
        <div className="w-8 h-8 border-2 border-dg-info border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-50 w-full max-w-md bg-dg-card border border-dg-border rounded-dg-lg shadow-[0px_24px_48px_rgba(0,0,0,0.4)] overflow-hidden"
      >
        <div className="p-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-dg-action/10 rounded-full flex items-center justify-center mb-4">
            <Edit2 className="w-6 h-6 text-dg-action-text" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold font-headline text-dg-text tracking-tight">Editar Usuario</h2>
          <p className="text-dg-text-muted text-sm mt-1">{user?.nombre ?? "—"} — ID #{id?.substring(0, 8)}</p>
        </div>

        <div className="px-6 pb-8 space-y-8">
          <div className="space-y-3">
            <span id="estado-usuario-label" className="block text-[10px] font-bold tracking-widest text-dg-text-muted uppercase font-display">ESTADO DEL USUARIO</span>
            <div className="flex items-center justify-between bg-dg-bg p-4 rounded-dg border border-dg-border">
              <span className="text-dg-text font-medium">{isActive ? "Activo" : "Inactivo"}</span>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                aria-labelledby="estado-usuario-label"
                aria-describedby="estado-usuario-ayuda"
                onClick={() => setIsActive(!isActive)}
                className="relative inline-flex items-center cursor-pointer rounded-full"
              >
                <span className={`block w-12 h-6 rounded-full transition-colors ${isActive ? 'bg-dg-success' : 'bg-dg-border'}`} />
                <span className={`absolute w-5 h-5 bg-dg-bg rounded-full shadow-sm transition-transform ${isActive ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </div>
            <p id="estado-usuario-ayuda" className="text-[10px] text-dg-text-muted leading-relaxed px-1">
              Si se desactiva, la cámara no reconocerá a esta persona
            </p>
          </div>

          <div className="space-y-3">
            <label htmlFor="editar-notas" className="block text-[10px] font-bold tracking-widest text-dg-text-muted uppercase font-display">NOTAS</label>
            <textarea 
              id="editar-notas"
              className="w-full bg-dg-bg border border-dg-border text-dg-text rounded-dg p-4 min-h-[100px] focus:border-dg-focus transition-colors resize-none text-sm"
              placeholder="Ingrese notas del usuario..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          <div className="space-y-3 pt-4">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Save className="w-5 h-5" /> {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
            <button 
              onClick={() => navigate(-1)}
              className="btn-secondary w-full py-4"
            >
              Cancelar
            </button>
          </div>
        </div>
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-dg-border-hi to-transparent" />
      </motion.div>
    </div>
  );
}
