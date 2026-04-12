import { useNavigate } from "react-router-dom";
import { UserPlus, Info, Video, Home, History, Users, Settings } from "lucide-react";
import { motion } from "motion/react";

export default function RegisterStart() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dg-bg overflow-hidden relative">
      {/* Blurred background content */}
      <div className="absolute inset-0 blur-md opacity-40 pointer-events-none">
        <header className="bg-dg-bg border-b border-dg-border px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-dg-accent" />
            <h1 className="text-xl font-bold tracking-tight font-headline">Usuarios</h1>
          </div>
        </header>
        <main className="p-4 space-y-3">
          <div className="cyber-card h-20 w-full" />
          <div className="cyber-card h-20 w-full" />
        </main>
      </div>

      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-40" />

      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-dg-bg rounded-t-2xl border-t border-x border-dg-border p-6 shadow-[0px_-24px_48px_rgba(0,0,0,0.6)] max-h-[92vh] overflow-y-auto"
      >
        <div className="w-12 h-1 bg-dg-border rounded-full mx-auto mb-8 shrink-0" />
        
        <div className="flex items-center gap-4 mb-6 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-dg-accent/10 flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-dg-accent" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight font-headline">Registrar Nuevo Usuario</h2>
        </div>

        <div className="space-y-6 pb-10">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-widest text-dg-text-muted px-1">NOMBRE COMPLETO</label>
              <input 
                type="text" 
                placeholder="Ej: Juan Pérez"
                className="w-full bg-dg-card border border-dg-border rounded-xl px-4 py-3 text-white placeholder:text-dg-text-muted/50 focus:ring-2 focus:ring-dg-accent/30 outline-none text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold tracking-widest text-dg-text-muted px-1">NOTAS (OPCIONAL)</label>
              <input 
                type="text" 
                placeholder="Ej: Empleado piso 3, Visitante temporal"
                className="w-full bg-dg-card border border-dg-border rounded-xl px-4 py-3 text-white placeholder:text-dg-text-muted/50 focus:ring-2 focus:ring-dg-accent/30 outline-none text-sm"
              />
            </div>
          </div>

          <div className="bg-dg-card border border-dg-border rounded-2xl p-4 flex gap-4">
            <Info className="w-6 h-6 text-dg-accent shrink-0" />
            <div className="space-y-2">
              <p className="text-sm text-white leading-snug">
                La persona debe estar frente a la cámara durante el registro. Se capturarán 5 ángulos faciales en aproximadamente 30 segundos.
              </p>
              <p className="text-[11px] text-dg-text-muted">
                Asegúrese de buena iluminación y que el rostro sea claramente visible.
              </p>
            </div>
          </div>

          <div className="space-y-6 pt-2">
            <div className="flex justify-between items-center max-w-sm mx-auto">
              {[1, 2, 3, 4, 5].map((step) => (
                <div key={step} className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-dg-card border border-dg-border flex items-center justify-center text-xs text-dg-text-muted font-bold">
                    {step}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-xs text-dg-text-muted font-medium">Paso 0 de 5</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button 
              onClick={() => navigate("/register/step3")}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2"
            >
              <Video className="w-5 h-5" /> Iniciar Registro
            </button>
            <button 
              onClick={() => navigate("/users")}
              className="btn-secondary w-full py-4"
            >
              Cancelar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
