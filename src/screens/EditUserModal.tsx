import { useNavigate } from "react-router-dom";
import { Edit2, Save, X } from "lucide-react";
import { motion } from "motion/react";

export default function EditUserModal() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-50 w-full max-w-md bg-dg-card border border-dg-border rounded-2xl shadow-[0px_24px_48px_rgba(0,0,0,0.4)] overflow-hidden"
      >
        <div className="p-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-dg-accent/10 rounded-full flex items-center justify-center mb-4">
            <Edit2 className="w-6 h-6 text-dg-accent" />
          </div>
          <h2 className="text-2xl font-bold font-headline text-white tracking-tight">Editar Usuario</h2>
          <p className="text-dg-text-muted text-sm mt-1">Juan Pérez — ID #1</p>
        </div>

        <div className="px-6 pb-8 space-y-8">
          <div className="space-y-3">
            <label className="block text-[10px] font-bold tracking-widest text-dg-text-muted uppercase font-display">ESTADO DEL USUARIO</label>
            <div className="flex items-center justify-between bg-dg-bg p-4 rounded-xl border border-dg-border">
              <span className="text-white font-medium">Activo</span>
              <div className="relative inline-flex items-center cursor-pointer">
                <div className="w-12 h-6 bg-dg-accent rounded-full transition-colors" />
                <div className="absolute right-0.5 w-5 h-5 bg-dg-bg rounded-full shadow-sm" />
              </div>
            </div>
            <p className="text-[10px] text-dg-text-muted leading-relaxed px-1">
              Si se desactiva, la cámara no reconocerá a esta persona
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-[10px] font-bold tracking-widest text-dg-text-muted uppercase font-display">NOTAS</label>
            <textarea 
              className="w-full bg-dg-bg border border-dg-border text-white rounded-xl p-4 min-h-[100px] focus:ring-1 focus:ring-dg-accent focus:border-dg-accent transition-all resize-none text-sm outline-none"
              placeholder="Ingrese notas del usuario..."
              defaultValue="Empleado piso 3"
            />
          </div>

          <div className="space-y-3 pt-4">
            <button 
              onClick={() => navigate("/profile/juan")}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" /> Guardar Cambios
            </button>
            <button 
              onClick={() => navigate("/profile/juan")}
              className="btn-secondary w-full py-4"
            >
              Cancelar
            </button>
          </div>
        </div>
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-dg-accent to-transparent opacity-30" />
      </motion.div>
    </div>
  );
}
