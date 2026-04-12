import { Video, Activity, Cloud, User } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";

export default function LiveMonitor() {
  return (
    <div className="min-h-screen pb-24 flex flex-col">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Video className="w-6 h-6 text-dg-accent" />
            <h1 className="text-xl font-bold tracking-tight font-headline">Vivo</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-6">
          <Video className="w-5 h-5 text-dg-accent" />
          <h2 className="font-headline text-lg font-bold tracking-tight">Monitor en Vivo</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Camera Feed - Takes 8 columns on large screens */}
          <div className="lg:col-span-8 space-y-4">
            <div className="cyber-card aspect-[16/9] relative overflow-hidden shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 z-10" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-dg-text-muted/20">
                <Video className="w-16 h-16 mb-4 opacity-10" />
                <span className="text-[10px] font-headline tracking-widest uppercase opacity-40">Conectando video en vivo...</span>
              </div>
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-dg-bg/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-dg-accent/20">
                <span className="w-2 h-2 bg-dg-accent rounded-full shadow-[0_0_8px_#a3ff00] animate-pulse" />
                <span className="text-[10px] font-bold tracking-widest uppercase text-dg-accent">En vivo</span>
              </div>
            </div>

            {/* Connection Status - Desktop version below camera */}
            <div className="hidden lg:flex items-center justify-between cyber-card p-4">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 flex items-center justify-center bg-dg-accent/10 rounded-lg">
                  <Cloud className="w-5 h-5 text-dg-accent" />
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-dg-accent rounded-full border-2 border-dg-card animate-pulse" />
                </div>
                <div>
                  <div className="text-[9px] font-bold text-dg-text-muted uppercase tracking-wider">Protocolo WebSocket</div>
                  <div className="text-[11px] font-bold text-dg-accent flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-dg-accent" /> Conectado
                  </div>
                </div>
              </div>
              <div className="text-[10px] font-mono text-dg-text-muted">LATENCY: 24ms</div>
            </div>
          </div>

          {/* Sidebar - Takes 4 columns on large screens */}
          <div className="lg:col-span-4 space-y-4">
            {/* Status Card */}
            <div className="cyber-card p-4 relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-dg-accent" />
              <div className="flex items-start justify-between relative z-10 ml-1">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-dg-accent">
                    <CheckCircle className="w-3 h-3 fill-dg-accent" />
                    <span className="text-[10px] font-bold tracking-widest uppercase">Estatus de Seguridad</span>
                  </div>
                  <h3 className="font-headline text-xl font-bold text-white uppercase tracking-tight">Acceso Permitido</h3>
                </div>
                <div className="bg-dg-bg px-3 py-2 rounded-lg border border-dg-border flex flex-col items-end">
                  <span className="text-[9px] text-dg-text-muted font-bold uppercase">Confianza</span>
                  <span className="text-xl font-headline font-black text-dg-accent">92%</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 bg-dg-bg p-3 rounded-lg border border-dg-border ml-1">
                <div className="w-10 h-10 rounded-full bg-dg-accent/10 flex items-center justify-center shrink-0">
                  <User className="w-6 h-6 text-dg-accent fill-dg-accent" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] text-dg-text-muted uppercase font-bold tracking-wider">Sujeto Detectado</div>
                  <div className="text-base font-bold text-white truncate">Juan Pérez</div>
                </div>
              </div>
            </div>

            {/* Metrics Card */}
            <div className="cyber-card p-4">
              <h4 className="text-[10px] font-bold text-dg-text-muted uppercase tracking-[0.15em] mb-5">Métricas Anti-Spoofing</h4>
              <div className="space-y-4">
                <MetricBar label="Varianza de Profundidad" value={2.1} progress={62} />
                <MetricBar label="Rango 3D" value="6.5 cm" progress={70} />
                <MetricBar label="Distancia Física" value="45 cm" progress={50} color="bg-blue-500" />
              </div>
            </div>

            {/* Connection Status - Mobile version */}
            <div className="lg:hidden flex items-center justify-between cyber-card p-4">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 flex items-center justify-center bg-dg-accent/10 rounded-lg">
                  <Cloud className="w-5 h-5 text-dg-accent" />
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-dg-accent rounded-full border-2 border-dg-card animate-pulse" />
                </div>
                <div>
                  <div className="text-[9px] font-bold text-dg-text-muted uppercase tracking-wider">Protocolo WebSocket</div>
                  <div className="text-[11px] font-bold text-dg-accent flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-dg-accent" /> Conectado
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Navigation />
    </div>
  );
}

function CheckCircle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function MetricBar({ label, value, progress, color = "bg-dg-accent" }: { label: string, value: string | number, progress: number, color?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className="text-[10px] font-mono text-dg-text-muted">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-dg-bg rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={`h-full ${color} rounded-full shadow-[0_0_8px_rgba(163,255,0,0.3)]`} 
        />
      </div>
    </div>
  );
}
