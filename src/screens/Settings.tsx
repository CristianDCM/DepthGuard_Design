import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings as SettingsIcon, Server, Video, Bell, Database, Shield, LogOut } from "lucide-react";
import Navigation from "../components/Navigation";
import { getEstadoSistema, isEdgeOnline, logoutAdmin, type EstadoSistema } from "../lib/supabase";

export default function Settings() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const data = await getEstadoSistema();
        setEstado(data);
      } catch (err) {
        console.error("Error cargando estado:", err);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  const handleLogout = async () => {
    await logoutAdmin();
    localStorage.removeItem("dg_admin");
    navigate("/");
  };

  // Verificar si el nodo edge está online basado en heartbeat
  const servidorConectado = isEdgeOnline(estado?.ultimo_heartbeat ?? null);

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
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-dg-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <section className="cyber-card p-5 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-dg-accent">Estado del Sistema</h2>
                <div className="space-y-4">
                  <StatusRow label="Nodo Edge" icon={Server} connected={servidorConectado} />
                  {(estado?.camaras ?? []).map((cam) => (
                    <div key={cam.camera_id}>
                      <StatusRow 
                        label={`${cam.camera_id === "entrada_principal" ? "Cámara Principal" : "Cámara Secundaria"} (${cam.camera_type})`}
                        icon={Video}
                        connected={cam.activa}
                      />
                    </div>
                  ))}
                  <StatusRow label="Push" icon={Bell} connected={true} />
                  <StatusRow label="Base de Datos" icon={Database} connected={true} />
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
                      <TechRow label="Anti-spoofing" value={estado?.antispoofing_activo ? "ACTIVO" : "INACTIVO"} highlight={estado?.antispoofing_activo} />
                      <TechRow label="Tolerancia facial" value={String(estado?.tolerancia_facial ?? "—")} />
                      <TechRow label="Umbral varianza" value={String(estado?.umbral_varianza ?? "—")} />
                      <TechRow label="Cooldown eventos" value={`${estado?.cooldown_eventos ?? "—"}s`} />
                      <TechRow label="Cámaras" value={`${estado?.camaras?.length ?? 0} conectadas`} />
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="cyber-card p-8 text-center space-y-6">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-dg-bg rounded-2xl shadow-inner border border-dg-accent/10">
                  <Shield className="w-12 h-12 text-dg-accent fill-dg-accent/10" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-dg-accent tracking-tighter font-headline">DepthGuard</h3>
                  <p className="text-sm font-medium mt-1">Proyecto de Grado 2026</p>
                  <p className="text-xs text-dg-text-muted mt-1">Institución Universitaria de Colombia</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {["Edge Computing", "MediaPipe", "dlib", "Supabase", "Realtime", "Vercel"].map((tag) => (
                    <span key={tag} className="px-3 py-1 bg-dg-bg text-[10px] font-bold text-dg-accent rounded-full border border-dg-accent/10">
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        <button 
          onClick={handleLogout}
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

function StatusRow({ label, icon: Icon, connected }: { label: string, icon: any, connected: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-dg-text-muted" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className={`flex items-center gap-2 px-2 py-1 rounded-full ${connected ? 'bg-dg-success/10' : 'bg-dg-error/10'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-dg-success animate-pulse' : 'bg-dg-error'}`} />
        <span className={`text-[10px] font-bold uppercase ${connected ? 'text-dg-success' : 'text-dg-error'}`}>
          {connected ? "Conectado" : "Desconectado"}
        </span>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked: initialChecked }: { label: string, checked?: boolean }) {
  const [isChecked, setIsChecked] = useState(initialChecked || false);

  return (
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium">{label}</span>
      <div 
        onClick={() => setIsChecked(!isChecked)}
        className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${isChecked ? 'bg-dg-accent' : 'bg-slate-800'}`}
      >
        <div className={`w-5 h-5 rounded-full transition-transform shadow-sm ${isChecked ? 'translate-x-5 bg-dg-bg' : 'bg-dg-text-muted'}`} />
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
