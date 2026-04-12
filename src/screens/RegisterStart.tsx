import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, Info, Video, Home, History, Users, Settings, Check, RotateCw, Hourglass, CheckCircle, ArrowLeft } from "lucide-react";
import { motion } from "motion/react";

export default function RegisterStart() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "scanning" | "success">("form");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const handleStartRegistration = () => {
    if (!name.trim()) {
      setError("El nombre completo es obligatorio");
      return;
    }
    setError("");
    setStep("scanning");
  };

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
        
        {step === "form" && (
          <>
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
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(""); }}
                    className={`w-full bg-dg-card border ${error ? 'border-dg-error' : 'border-dg-border'} rounded-xl px-4 py-3 text-white placeholder:text-dg-text-muted/50 focus:ring-2 focus:ring-dg-accent/30 outline-none text-sm`}
                  />
                  {error && <p className="text-xs text-dg-error px-1 mt-1">{error}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-dg-text-muted px-1">NOTAS (OPCIONAL)</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Empleado piso 3, Visitante temporal"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
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
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-dg-card border border-dg-border flex items-center justify-center text-xs text-dg-text-muted font-bold">
                        {s}
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
                  onClick={handleStartRegistration}
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
          </>
        )}

        {step === "scanning" && (
          <>
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
                  onClick={() => setStep("success")}
                  className="btn-primary w-full py-4 flex items-center justify-center gap-2"
                >
                  <Video className="w-5 h-5" /> Capturando...
                </button>
                <button 
                  onClick={() => setStep("form")}
                  className="btn-secondary w-full py-4"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </>
        )}

        {step === "success" && (
          <div className="px-2 pb-10 space-y-8">
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
                  <span className="text-dg-accent font-bold text-lg">
                    {name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-white">{name}</p>
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
        )}
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

