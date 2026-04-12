import { useNavigate } from "react-router-dom";
import { ArrowLeft, MoreVertical, UserSearch, Plus, FileText, Fingerprint } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";

export default function UnknownDetail() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-32 flex flex-col bg-dg-bg">
      <header className="fixed top-0 w-full z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border text-dg-accent">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="hover:opacity-80 transition-opacity active:scale-95">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="font-headline text-xl font-bold tracking-tight text-white">Detalle de Evento</h1>
          </div>
        </div>
      </header>

      <main className="mt-20 px-6 max-w-7xl mx-auto pb-32 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Image and Status */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex justify-center lg:justify-start">
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
          </div>

          {/* Right Column: Details and Actions */}
          <div className="lg:col-span-5 space-y-6">
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

            <div className="cyber-card p-5 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-headline font-bold text-white text-base">Análisis Biométrico</h2>
                <Fingerprint className="w-6 h-6 text-yellow-500" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <MetricItem label="Confianza" value="0% / Sin match" progress={0} color="bg-yellow-500" />
                <MetricItem label="Varianza de Profundidad" value="1.8" progress={75} color="bg-dg-success" />
                <MetricItem label="Rango 3D" value="5.2 cm" progress={85} color="bg-dg-success" />
                <MetricItem label="Distancia" value="55 cm" progress={50} color="bg-blue-400" />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button className="btn-primary w-full py-4 flex items-center justify-center gap-2">
                <FileText className="w-5 h-5" /> Descargar Informe
              </button>
              <button 
                onClick={() => navigate(-1)}
                className="btn-secondary w-full py-4"
              >
                Cerrar Detalles
              </button>
            </div>
          </div>
        </div>
      </main>

      <Navigation />
    </div>
  );
}

function MetricItem({ label, value, progress, color = "bg-dg-accent" }: { label: string, value: string, progress: number, color?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-dg-text-muted text-xs uppercase tracking-widest font-semibold">{label}</span>
        <span className={`${color.replace('bg-', 'text-')} font-bold text-sm`}>{value}</span>
      </div>
      <div className="w-full bg-dg-bg rounded-full h-1.5 overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={`${color} h-full rounded-full`} 
        />
      </div>
    </div>
  );
}
