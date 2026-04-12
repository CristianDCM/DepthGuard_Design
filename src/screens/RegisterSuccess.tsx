import { useNavigate } from "react-router-dom";
import { CheckCircle, ArrowLeft, Check } from "lucide-react";
import { motion } from "motion/react";

export default function RegisterSuccess() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-dg-bg overflow-hidden relative">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-40" />

      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        className="fixed bottom-0 inset-x-0 z-50 bg-dg-bg border-t border-x border-dg-border rounded-t-[32px] w-full max-w-lg mx-auto"
      >
        <div className="flex justify-center pt-4 pb-6">
          <div className="w-12 h-1.5 bg-dg-border rounded-full" />
        </div>

        <div className="px-6 pb-10 space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="absolute inset-0 bg-dg-success/20 blur-xl rounded-full" />
              <CheckCircle className="w-16 h-16 text-dg-success relative z-10 fill-dg-success/10" />
            </div>
            <div>
              <h2 className="text-[20px] font-bold text-white leading-tight font-headline">¡Registro Exitoso!</h2>
              <p className="text-dg-text-muted text-sm mt-1">Usuario registrado correctamente en el sistema</p>
            </div>
          </div>

          <div className="bg-dg-card p-4 rounded-2xl flex items-center justify-between border border-dg-border">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-dg-accent/10 flex items-center justify-center border border-dg-accent/20">
                <span className="text-dg-accent font-bold text-lg">CG</span>
              </div>
              <div>
                <p className="font-bold text-white">Carlos García</p>
                <p className="text-xs text-dg-text-muted">ID: #002341</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-dg-success/20 px-3 py-1 rounded-full border border-dg-success/30">
              <span className="w-2 h-2 rounded-full bg-dg-success" />
              <span className="text-[10px] font-bold text-dg-success uppercase tracking-wider">Activo</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="relative flex justify-between items-center px-2">
              <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-dg-accent -translate-y-1/2 z-0" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="relative z-10 flex flex-col items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-dg-accent flex items-center justify-center shadow-[0_0_12px_rgba(163,255,0,0.4)]">
                    <Check className="w-4 h-4 text-dg-bg font-bold" />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-dg-text-muted text-[10px] font-medium tracking-wide">5 de 5 ángulos capturados</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-dg-card p-4 rounded-xl border border-dg-border flex flex-col items-center justify-center">
              <span className="text-dg-accent text-2xl font-bold font-headline">5</span>
              <span className="text-dg-text-muted text-[10px] uppercase tracking-widest font-semibold">Angles</span>
            </div>
            <div className="bg-dg-card p-4 rounded-xl border border-dg-border flex flex-col items-center justify-center">
              <span className="text-white text-2xl font-bold font-headline">30s</span>
              <span className="text-dg-text-muted text-[10px] uppercase tracking-widest font-semibold">Time</span>
            </div>
          </div>

          <button 
            onClick={() => navigate("/users")}
            className="btn-primary w-full h-14 flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Volver a Usuarios</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
