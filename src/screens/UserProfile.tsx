import { useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Edit2, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";

export default function UserProfile() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24 flex flex-col bg-dg-bg">
      <header className="fixed top-0 w-full z-50 bg-dg-bg flex items-center px-6 h-16 border-b border-dg-border">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="active:scale-95 transition-transform">
            <ArrowLeft className="w-6 h-6 text-dg-accent" />
          </button>
          <h1 className="font-headline font-bold text-xl tracking-wider text-white">Perfil de Usuario</h1>
        </div>
      </header>

      <main className="pt-20 px-6 max-w-2xl mx-auto space-y-6 w-full">
        <section className="flex flex-col items-center text-center space-y-4 py-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-dg-accent flex items-center justify-center shadow-[0_0_20px_rgba(163,255,0,0.3)]">
              <span className="font-headline font-black text-3xl text-dg-bg">JP</span>
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-dg-bg rounded-full flex items-center justify-center border-2 border-dg-bg">
              <div className="w-3 h-3 bg-dg-success rounded-full animate-pulse" />
            </div>
          </div>
          <div>
            <h2 className="font-headline font-bold text-2xl text-white">Juan Pérez</h2>
          </div>
        </section>

        <div className="bg-dg-card p-6 rounded-xl space-y-4 border border-dg-border">
          <h3 className="font-headline font-bold text-sm text-dg-text-muted uppercase tracking-widest mb-4">Información</h3>
          <div className="space-y-4">
            <InfoRow label="ID" value="#1" mono />
            <InfoRow label="Fecha de Registro" value="12/05/2026" />
            <InfoRow label="Ángulos capturados" value="5 de 5" />
            <InfoRow label="Notas" value="Empleado piso 3" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-dg-card p-5 rounded-xl border-l-2 border-dg-accent border-y border-r border-dg-border">
            <p className="text-dg-text-muted text-[10px] font-bold uppercase tracking-widest">Accesos Totales</p>
            <p className="font-headline font-black text-4xl text-dg-accent mt-1">24</p>
          </div>
          <div className="bg-dg-card p-5 rounded-xl border-l-2 border-dg-text-muted border-y border-r border-dg-border">
            <p className="text-dg-text-muted text-[10px] font-bold uppercase tracking-widest">Alertas Generadas</p>
            <p className="font-headline font-black text-4xl text-white mt-1">0</p>
          </div>
        </div>

        <div className="bg-dg-card p-6 rounded-xl border border-dg-border">
          <h3 className="font-headline font-bold text-sm text-dg-text-muted uppercase tracking-widest mb-4">Últimas Capturas</h3>
          <div className="grid grid-cols-3 gap-3">
            <CaptureThumb seed="face1" time="14:20" />
            <CaptureThumb seed="face2" time="12:05" />
            <CaptureThumb seed="face3" time="09:45" />
          </div>
        </div>

        <div className="space-y-3 pt-4">
          <button 
            onClick={() => navigate("/users/edit")}
            className="w-full py-4 rounded-xl border border-dg-accent text-dg-accent font-headline font-bold uppercase tracking-widest text-sm bg-dg-accent/5 hover:bg-dg-accent/10 transition-all active:scale-95"
          >
            Editar Usuario
          </button>
          <button 
            onClick={() => navigate("/users/delete/confirm")}
            className="w-full py-4 rounded-xl border border-dg-error/40 text-dg-error font-headline font-bold uppercase tracking-widest text-sm hover:bg-dg-error/10 transition-all active:scale-95"
          >
            Eliminar Usuario
          </button>
        </div>
      </main>

      <Navigation />
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string, value: string, mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-dg-text-muted text-sm font-medium">{label}</span>
      <span className={`text-white text-sm ${mono ? 'font-mono bg-dg-bg px-2 py-1 rounded' : ''}`}>{value}</span>
    </div>
  );
}

function CaptureThumb({ seed, time }: { seed: string, time: string }) {
  return (
    <div className="aspect-square bg-dg-bg rounded-lg overflow-hidden border border-dg-border relative group">
      <img 
        className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300" 
        src={`https://picsum.photos/seed/${seed}/200/200`} 
        alt="Capture"
        referrerPolicy="no-referrer"
      />
      <div className="absolute bottom-1 right-1 bg-dg-bg/80 text-[8px] px-1 rounded font-mono text-white">{time}</div>
    </div>
  );
}
