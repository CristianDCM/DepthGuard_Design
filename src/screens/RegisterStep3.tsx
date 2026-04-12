import { useNavigate } from "react-router-dom";
import { UserPlus, Check, RotateCw, Video, Hourglass } from "lucide-react";
import { motion } from "motion/react";

export default function RegisterStep3() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dg-bg overflow-hidden relative">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-40" />

      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-dg-bg rounded-t-2xl border-t border-x border-dg-border p-6 shadow-[0px_-24px_48px_rgba(0,0,0,0.6)] max-h-[92vh] overflow-y-auto"
      >
        <div className="w-12 h-1 bg-dg-border rounded-full mx-auto mb-8 shrink-0" />
        
        <div className="flex items-center gap-4 mb-6 shrink-0">
          <div className="w-10 h-10 rounded-lg bg-dg-accent/10 flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-dg-accent" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight font-headline">Registrar Nuevo Usuario</h2>
        </div>

        <div className="space-y-6 pb-10">
          <div className="flex justify-between items-center relative px-2">
            <div className="absolute top-[18px] -translate-y-1/2 left-8 right-8 h-[2px] bg-dg-border z-0" />
            <div className="absolute top-[18px] -translate-y-1/2 left-8 w-1/2 h-[2px] bg-dg-accent z-0" />
            
            <StepIndicator step={1} label="Frontal" completed />
            <StepIndicator step={2} label="Der. leve" completed />
            <StepIndicator step={3} label="Der. full" active />
            <StepIndicator step={4} label="Izq. leve" />
            <StepIndicator step={5} label="Izq. full" />
          </div>

          <div className="text-center mt-6 flex flex-col gap-1">
            <p className="text-dg-text-muted text-[10px] uppercase font-bold tracking-widest">Paso 3 de 5</p>
            <p className="text-dg-text-muted/50 text-[9px] font-medium">Tiempo restante: 45s</p>
          </div>

          <div className="cyber-card p-6 text-center mb-8 relative overflow-hidden">
            <div className="mb-4 flex justify-center">
              <RotateCw className="w-12 h-12 text-dg-accent animate-spin-slow" />
            </div>
            <h3 className="text-white font-bold text-lg mb-1">Gire la cabeza a la DERECHA</h3>
            <p className="text-dg-text-muted text-xs mb-4">Gire más, hasta que la cámara capture el ángulo completo</p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-dg-accent/10 border border-dg-accent/20">
              <Hourglass className="w-3.5 h-3.5 text-dg-accent animate-pulse" />
              <span className="text-[10px] font-bold text-dg-accent uppercase tracking-wider">Capturando ángulo derecho...</span>
            </div>
          </div>

          <div className="space-y-3">
            <button 
              onClick={() => navigate("/register/success")}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2"
            >
              <Video className="w-5 h-5" /> Capturando...
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

function StepIndicator({ step, label, completed, active }: { step: number, label: string, completed?: boolean, active?: boolean }) {
  return (
    <div className="flex flex-col items-center relative z-10 gap-2">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
        completed ? "bg-dg-accent text-dg-bg" : 
        active ? "bg-dg-bg border-2 border-dg-accent text-dg-accent shadow-[0_0_15px_rgba(163,255,0,0.2)]" : 
        "bg-dg-card border border-dg-border text-dg-text-muted"
      }`}>
        {completed ? <Check className="w-5 h-5" /> : <span className="text-sm font-bold">{step}</span>}
      </div>
      <span className={`text-[8px] font-bold uppercase tracking-tighter ${active || completed ? "text-dg-accent" : "text-dg-text-muted/60"}`}>
        {label}
      </span>
    </div>
  );
}
