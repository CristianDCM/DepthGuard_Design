import { useNavigate } from "react-router-dom";
import { Settings as SettingsIcon, Server, Video, Bell, Database, Shield, LogOut, Info } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";

export default function Settings() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24 flex flex-col bg-dg-bg">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-dg-accent" />
            <h1 className="text-xl font-bold tracking-tight font-headline">Ajustes</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <section className="cyber-card p-5 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-dg-accent">Estado del Sistema</h2>
              <div className="space-y-4">
                <StatusRow label="Servidor" icon={Server} status="Conectado" />
                <StatusRow label="Cámara" icon={Video} status="Activa" />
                <StatusRow label="Push" icon={Bell} status="Configurado" />
                <StatusRow label="Base de Datos" icon={Database} status="OK" />
              </div>
            </section>

            <section className="cyber-card p-5 space-y-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-dg-accent">Notificaciones</h2>
              <div className="space-y-6">
                <ToggleRow label="Alertas de fraude" checked />
                <ToggleRow label="Accesos permitidos" />
                <ToggleRow label="Desconocidos" checked />
                <button className="w-full py-3 bg-dg-accent/10 border border-dg-accent/20 rounded-lg text-[10px] font-bold uppercase tracking-widest text-dg-accent hover:bg-dg-accent/20 transition-all active:scale-95">
                  Enviar notificación de prueba
                </button>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="cyber-card overflow-hidden p-5 space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-dg-accent">Información Técnica</h2>
              <div className="rounded-lg overflow-hidden border border-dg-border">
                <table className="w-full text-left text-xs">
                  <tbody className="divide-y divide-dg-border">
                    <TechRow label="Modo cámara" value="simulada" />
                    <TechRow label="Anti-spoofing" value="ACTIVO" highlight />
                    <TechRow label="Tolerancia facial" value="0.55" />
                    <TechRow label="Umbral varianza" value="1.0" />
                    <TechRow label="Cooldown eventos" value="5s" />
                  </tbody>
                </table>
              </div>
            </section>

            <section className="cyber-card p-8 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-dg-bg rounded-2xl shadow-inner border border-dg-accent/10">
                <Shield className="w-12 h-12 text-dg-accent fill-dg-accent/10" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-dg-accent tracking-tighter uppercase font-headline">DepthGuard</h3>
                <p className="text-sm font-medium mt-1">Proyecto de Grado 2026</p>
                <p className="text-xs text-dg-text-muted mt-1">Institución Universitaria de Colombia</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {["FastAPI", "MediaPipe", "dlib", "Tailwind"].map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-dg-bg text-[10px] font-bold text-dg-accent rounded-full border border-dg-accent/10">
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </div>

        <button 
          onClick={() => navigate("/")}
          className="w-full py-4 rounded-xl border border-dg-error/30 bg-dg-error/5 flex items-center justify-center gap-3 group hover:bg-dg-error/10 transition-colors active:scale-95 max-w-md mx-auto"
        >
          <LogOut className="w-5 h-5 text-dg-error" />
          <span className="text-sm font-bold uppercase tracking-widest text-dg-error">Cerrar Sesión</span>
        </button>
      </main>

      <Navigation />
    </div>
  );
}

function StatusRow({ label, icon: Icon, status }: { label: string, icon: any, status: string }) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-dg-text-muted" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2 px-2 py-1 bg-dg-success/10 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-dg-success animate-pulse" />
        <span className="text-[10px] font-bold text-dg-success uppercase">{status}</span>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked }: { label: string, checked?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium">{label}</span>
      <div className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${checked ? 'bg-dg-accent' : 'bg-slate-800'}`}>
        <div className={`w-5 h-5 rounded-full transition-transform shadow-sm ${checked ? 'translate-x-5 bg-dg-bg' : 'bg-dg-text-muted'}`} />
      </div>
    </div>
  );
}

function TechRow({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <tr className="bg-dg-bg/30">
      <td className="p-3 text-dg-text-muted">{label}</td>
      <td className={`p-3 text-right ${highlight ? 'font-bold text-dg-success uppercase text-[10px]' : 'font-medium'}`}>{value}</td>
    </tr>
  );
}

