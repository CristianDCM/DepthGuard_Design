import { useNavigate } from "react-router-dom";
import { ArrowLeft, ShieldAlert, FileText, Fingerprint, LayoutDashboard, History, Video, Settings } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";

export default function FraudDetail() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24 flex flex-col bg-dg-bg">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="hover:bg-dg-card p-2 rounded-lg active:scale-95 transition-all">
              <ArrowLeft className="w-6 h-6 text-dg-accent" />
            </button>
            <h1 className="font-headline font-bold text-lg tracking-tight text-white">Detalle de Fraude</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-4 pb-32 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Image and Status */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex justify-center lg:justify-start">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-dg-error/30 bg-dg-error/10">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-dg-error opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-dg-error" />
                </span>
                <span className="font-headline font-bold text-xs tracking-widest text-dg-error uppercase">FRAUDE DETECTADO</span>
              </div>
            </div>

            <section className="relative rounded-3xl overflow-hidden border border-dg-border aspect-[4/3] bg-dg-card">
              <div className="absolute inset-0 bg-dg-error/20 mix-blend-overlay z-10 pointer-events-none" />
              <img 
                className="w-full h-full object-cover grayscale opacity-80" 
                src="https://picsum.photos/seed/fraud-scan/800/600" 
                alt="Fraud scan"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-4 left-4 z-20">
                <div className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg">
                  <p className="font-mono text-xs text-white/90 tracking-tighter">2026-04-11 14:35:12</p>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Details and Actions */}
          <div className="lg:col-span-5 space-y-6">
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-dg-card p-6 rounded-2xl flex items-center gap-5 border border-dg-border">
                <div className="h-14 w-14 rounded-full bg-dg-error/20 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-8 h-8 text-dg-error" />
                </div>
                <div>
                  <h3 className="font-headline font-bold text-xl text-white">Intento de Suplantación</h3>
                  <p className="text-dg-text-muted text-sm">Ningún usuario identificado</p>
                </div>
              </div>

              <div className="bg-dg-card p-6 rounded-2xl border-l-4 border-dg-error border-y border-r border-dg-border">
                <h4 className="font-headline font-bold text-xs tracking-widest text-dg-error mb-3 uppercase">Motivo de Detección</h4>
                <p className="text-white text-base leading-relaxed">
                  Superficie plana detectada — Varianza de profundidad insuficiente para rostro real
                </p>
              </div>
            </div>

            <div className="cyber-card p-5 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-headline font-bold text-white text-base">Análisis Biométrico</h2>
                <Fingerprint className="w-6 h-6 text-dg-error" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <MetricItem label="Confianza" value="N/A" progress={0} color="bg-dg-error" />
                <MetricItem label="Varianza de Profundidad" value="0.3" progress={15} color="bg-dg-error" />
                <MetricItem label="Rango 3D" value="0.8 cm" progress={10} color="bg-dg-error" />
                <MetricItem label="Distancia" value="70 cm" progress={60} color="bg-blue-400" />
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
