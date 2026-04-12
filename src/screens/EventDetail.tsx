import { useNavigate } from "react-router-dom";
import { ArrowLeft, MoreVertical, Video, User, FileText, ExternalLink, Fingerprint } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";

export default function EventDetail() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24 flex flex-col">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="active:scale-95 transition-transform">
            <ArrowLeft className="w-6 h-6 text-dg-accent" />
          </button>
          <h1 className="font-headline font-bold tracking-tight text-lg text-white">Detalle del Evento</h1>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6 max-w-2xl mx-auto w-full">
        <section className="flex justify-center">
          <div className="px-6 py-3 rounded-full border-2 border-dg-accent/30 bg-dg-accent/10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-dg-accent animate-pulse" />
            <span className="font-headline font-bold text-dg-accent tracking-widest text-sm uppercase">ACCESO PERMITIDO</span>
          </div>
        </section>

        <div className="relative rounded-xl overflow-hidden cyber-card shadow-2xl">
          <img 
            className="w-full aspect-[4/3] object-cover opacity-80" 
            src="https://picsum.photos/seed/face-scan/800/600" 
            alt="Face scan"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-dg-bg via-transparent to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
            <div className="flex items-center gap-2 text-dg-accent">
              <Video className="w-4 h-4 fill-dg-accent" />
              <span className="text-xs font-bold font-headline uppercase tracking-tighter">Cámara</span>
            </div>
            <div className="text-right">
              <p className="text-dg-text-muted text-[10px] uppercase font-bold tracking-widest">Timestamp</p>
              <p className="text-white text-xs font-mono">2026-10-27 14:32:05</p>
            </div>
          </div>
        </div>

        <div className="cyber-card p-5 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-dg-accent/20 border-2 border-dg-accent flex items-center justify-center text-dg-accent font-headline font-bold text-xl">
            JP
          </div>
          <div className="flex-grow">
            <h3 className="text-white font-headline font-bold text-lg">Juan Pérez</h3>
            <p className="text-dg-text-muted text-xs font-mono">ID: #1</p>
          </div>
          <button 
            onClick={() => navigate("/profile/juan")}
            className="text-dg-accent text-xs font-bold font-headline flex items-center gap-1 hover:opacity-70 transition-all"
          >
            Ver Perfil <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        <div className="cyber-card p-5 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-headline font-bold text-white text-base">Análisis Biométrico</h2>
            <Fingerprint className="w-6 h-6 text-dg-accent" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <MetricItem label="Confianza" value="94%" progress={94} />
            <MetricItem label="Varianza de Profundidad" value="1.2" progress={40} />
            <MetricItem label="Rango 3D" value="6.5cm" progress={65} />
            <MetricItem label="Distancia" value="45cm" progress={45} color="bg-blue-400" />
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
