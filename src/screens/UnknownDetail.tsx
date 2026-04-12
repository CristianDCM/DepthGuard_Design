import { useNavigate } from "react-router-dom";
import { ArrowLeft, MoreVertical, UserSearch, Plus, FileText, Fingerprint } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";

export default function UnknownDetail() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-32 flex flex-col bg-dg-bg">
      <header className="fixed top-0 w-full z-50 bg-dg-bg text-dg-accent flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="hover:opacity-80 transition-opacity active:scale-95">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="font-headline text-xl font-bold tracking-tight text-white">Detalle de Evento</h1>
        </div>
      </header>

      <main className="mt-20 px-6 max-w-2xl mx-auto space-y-8 w-full">
        <div className="flex justify-center">
          <div className="bg-yellow-500/10 border border-yellow-500/30 px-4 py-2 rounded-full flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full animate-pulse" />
            </div>
            <span className="font-headline font-bold text-yellow-500 text-xs tracking-widest uppercase">PERSONA DESCONOCIDA</span>
          </div>
        </div>

        <div className="cyber-card rounded-xl overflow-hidden shadow-2xl relative border border-dg-border">
          <img 
            className="w-full aspect-video object-cover grayscale opacity-80" 
            src="https://picsum.photos/seed/unknown-scan/800/600" 
            alt="Unknown scan"
            referrerPolicy="no-referrer"
          />
          <div className="absolute bottom-4 right-4 bg-dg-bg/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-dg-border">
            <code className="text-[10px] text-dg-text-muted font-mono">2026-10-27 14:32:05</code>
          </div>
          <div className="absolute top-4 left-4">
            <div className="w-12 h-12 border-t-2 border-l-2 border-yellow-500/40 rounded-tl-lg" />
          </div>
          <div className="absolute bottom-4 left-4">
            <div className="w-12 h-12 border-b-2 border-l-2 border-yellow-500/40 rounded-bl-lg" />
          </div>
        </div>

        <div className="bg-dg-card rounded-xl p-8 text-center space-y-4 border border-dg-border">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500/10 text-yellow-500 mb-2">
            <UserSearch className="w-10 h-10" />
          </div>
          <div>
            <h2 className="font-headline text-2xl font-bold text-white tracking-tight">Persona No Registrada</h2>
            <p className="text-dg-text-muted text-sm mt-1">No se encontró coincidencia en la base de datos</p>
          </div>
        </div>

        <button 
          onClick={() => navigate("/register/start")}
          className="btn-primary w-full py-4 font-headline font-black uppercase tracking-tighter text-lg flex items-center justify-center gap-2"
        >
          <Plus className="w-6 h-6" /> Registrar esta persona
        </button>

        <div className="space-y-6 bg-dg-card p-6 rounded-xl border border-dg-border">
          <h3 className="font-headline text-xs font-bold text-dg-text-muted uppercase tracking-widest flex items-center gap-2">
            <Fingerprint className="w-4 h-4" /> Análisis Biométrico
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetricBox label="Confianza" value="0% / Sin match" progress={0} color="text-yellow-500" />
            <MetricBox label="Varianza de Profundidad" value="1.8" progress={75} color="text-dg-success" />
            <MetricBox label="Rango 3D" value="5.2 cm" progress={85} color="text-dg-success" />
            <MetricBox label="Distancia" value="55 cm" progress={50} color="text-blue-400" />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button className="w-full flex items-center justify-center gap-3 py-3 rounded-lg border border-dg-border text-white hover:bg-dg-card transition-colors">
            <FileText className="w-5 h-5 text-dg-error" />
            <span className="font-bold text-sm uppercase tracking-wider">Descargar Informe (PDF)</span>
          </button>
          <button 
            onClick={() => navigate(-1)}
            className="w-full py-3 text-dg-text-muted hover:text-white text-sm font-semibold uppercase tracking-widest transition-colors"
          >
            Cerrar Detalles
          </button>
        </div>
      </main>

      <Navigation />
    </div>
  );
}

function MetricBox({ label, value, progress, color }: { label: string, value: string, progress: number, color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-semibold uppercase tracking-tighter">
        <span className="text-dg-text-muted">{label}</span>
        <span className={color}>{value}</span>
      </div>
      <div className="h-1.5 bg-dg-bg rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={`h-full ${color.replace('text-', 'bg-')} rounded-full`} 
        />
      </div>
    </div>
  );
}
