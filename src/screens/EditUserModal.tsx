import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Edit2, Save } from "lucide-react";
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
      <div className="mini min-h-screen flex items-center justify-center bg-dg-canvas/80">
        <p role="status" className="text-xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Cargando</p>
      </div>
    );
  }

  return (
    <div className="mini min-h-screen flex items-center justify-center p-4 bg-dg-canvas/80">
      {/* Superficie opaca, no tarjeta flotante: la hoja va sobre el velo. */}
      <div className="relative z-50 w-full max-w-md border border-dg-border bg-dg-bg">
        <div className="p-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center border border-dg-border">
            <Edit2 className="w-6 h-6 text-dg-action-text" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold uppercase tracking-[0.8px] text-dg-text">Editar Usuario</h2>
          <p className="mt-2 text-xs uppercase tracking-[0.8px] text-dg-text-muted">{user?.nombre ?? "—"} — ID #{id?.substring(0, 8)}</p>
        </div>

        <div className="px-6 pb-8 space-y-8">
          <div className="space-y-3">
            <span id="estado-usuario-label" className="block text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Estado del usuario</span>
            <div className="flex items-center justify-between border border-dg-border p-4">
              <span className="text-dg-text font-medium">{isActive ? "Activo" : "Inactivo"}</span>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                aria-labelledby="estado-usuario-label"
                aria-describedby="estado-usuario-ayuda"
                onClick={() => setIsActive(!isActive)}
                className="relative inline-flex cursor-pointer items-center"
              >
                {/* Pista y perilla cuadradas, y el salto es inmediato. */}
                <span className={`block h-6 w-12 border ${isActive ? 'border-dg-success bg-dg-success' : 'border-dg-border'}`} />
                <span className={`absolute h-5 w-5 ${isActive ? 'right-0.5 bg-dg-bg' : 'left-0.5 bg-dg-text-muted'}`} />
              </button>
            </div>
            <p id="estado-usuario-ayuda" className="text-2xs text-dg-text-muted leading-relaxed px-1">
              Si se desactiva, la cámara no reconocerá a esta persona
            </p>
          </div>

          <div className="space-y-3">
            <label htmlFor="editar-notas" className="block text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Notas</label>
            <textarea 
              id="editar-notas"
              className="min-h-[100px] w-full resize-none border border-dg-border bg-transparent p-4 text-base text-dg-text placeholder:text-dg-text-muted focus:border-dg-text"
              placeholder="Ingrese notas del usuario..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </div>

          <div className="space-y-3 pt-4">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="mini-btn mini-btn-strong flex w-full items-center justify-center gap-2 py-4 text-sm disabled:opacity-50"
            >
              <Save className="h-5 w-5" aria-hidden="true" /> {saving ? "Guardando" : "Guardar Cambios"}
            </button>
            <button 
              onClick={() => navigate(-1)}
              className="mini-btn w-full py-4 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
