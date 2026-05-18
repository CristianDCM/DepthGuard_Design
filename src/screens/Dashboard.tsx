import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, AlertTriangle, HelpCircle, Video, History, Users, Home, Server } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";
import { supabase, getEstadisticasHoy, getUltimosEventos, getEstadoSistema, isEdgeOnline, isCamaraActiva, type Evento, type EstadoSistema } from "../lib/supabase";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ accesos: 0, fraudes: 0, desconocidos: 0, totalUsuarios: 0 });
  const [events, setEvents] = useState<Evento[]>([]);
  const [ultimoEvento, setUltimoEvento] = useState<string>("—");
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar datos iniciales
  useEffect(() => {
    async function cargarDatos() {
      try {
        const [estadisticas, ultimos] = await Promise.all([
          getEstadisticasHoy(),
          getUltimosEventos(3),
        ]);
        setStats(estadisticas);
        setEvents(ultimos);

        if (ultimos.length > 0) {
          const diff = Date.now() - new Date(ultimos[0].timestamp).getTime();
          const mins = Math.floor(diff / 60000);
          setUltimoEvento(mins < 1 ? "Ahora" : mins < 60 ? `Hace ${mins} min` : `Hace ${Math.floor(mins / 60)}h`);
        }

        // Estado del sistema (edge node + cámaras)
        const estadoData = await getEstadoSistema();
        if (estadoData) setEstado(estadoData);
      } catch (err) {
        console.error("Error cargando dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    cargarDatos();
  }, []);

  // Suscripción en tiempo real al historial
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "historial" },
        (payload) => {
          const nuevoEvento = payload.new as Evento;
          setEvents((prev) => [nuevoEvento, ...prev].slice(0, 3));
          setUltimoEvento("Ahora");
          // Actualizar contadores
          setStats((prev) => ({
            ...prev,
            accesos: prev.accesos + (nuevoEvento.estado === "ACCESO_PERMITIDO" ? 1 : 0),
            fraudes: prev.fraudes + (nuevoEvento.estado === "FRAUDE" ? 1 : 0),
            desconocidos: prev.desconocidos + (nuevoEvento.estado === "DESCONOCIDO" ? 1 : 0),
          }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Polling del heartbeat del edge cada 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const estadoData = await getEstadoSistema();
        if (estadoData) setEstado(estadoData);
      } catch { /* silenciar */ }
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const statsConfig = [
    { label: "Accesos", value: stats.accesos, sub: "hoy", icon: CheckCircle, color: "text-dg-success" },
    { label: "Fraudes", value: stats.fraudes, sub: "", icon: AlertTriangle, color: "text-dg-error" },
    { label: "Desconocidos", value: stats.desconocidos, sub: "hoy", icon: HelpCircle, color: "text-yellow-500" },
  ];

  function getEventConfig(evento: Evento) {
    switch (evento.estado) {
      case "ACCESO_PERMITIDO":
        return { title: "Acceso Autorizado", sub: `${evento.nombre ?? "—"} — ${Math.round((evento.confianza ?? 0) * 100)}% confianza`, icon: CheckCircle, color: "text-dg-success", border: false };
      case "FRAUDE":
        return { title: "Intento de Fraude", sub: evento.motivo ?? "Superficie plana detectada", icon: AlertTriangle, color: "text-dg-error", border: false };
      case "DESCONOCIDO":
        return { title: "Desconocido Detectado", sub: "Persona no registrada", icon: HelpCircle, color: "text-yellow-500", border: true };
    }
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="min-h-screen pb-24 flex flex-col bg-dg-bg">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <Home className="w-6 h-6 text-dg-accent" />
              <h1 className="text-xl font-bold tracking-tight font-headline">Inicio</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-dg-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              {statsConfig.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="cyber-card p-4 flex flex-col items-center justify-center text-center"
                >
                  <stat.icon className={`w-6 h-6 mb-2 ${stat.color}`} />
                  <span className={`text-3xl font-bold ${stat.color}`}>{stat.value}</span>
                  <span className="text-[10px] uppercase tracking-wider text-dg-text-muted font-bold leading-none mt-1">{stat.label}</span>
                  {stat.sub && <span className="text-[9px] text-dg-text-muted/60 font-medium mt-1">{stat.sub}</span>}
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* System Status */}
              <section>
                <div className="cyber-card overflow-hidden h-full">
                  <div className="px-4 py-3 border-b border-dg-border bg-white/5">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-dg-text-muted">Estado del Sistema</h2>
                  </div>
                  <div className="divide-y divide-dg-border">
                    <div className="flex items-center justify-between p-5">
                      <div className="flex items-center gap-3">
                        <Server className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-medium">Nodo Edge</span>
                      </div>
                      <span className={`text-xs font-bold flex items-center gap-1 ${isEdgeOnline(estado?.ultimo_heartbeat ?? null) ? 'text-dg-accent' : 'text-dg-error'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isEdgeOnline(estado?.ultimo_heartbeat ?? null) ? 'bg-dg-accent animate-pulse' : 'bg-dg-error'}`} />
                        {isEdgeOnline(estado?.ultimo_heartbeat ?? null) ? "ONLINE" : "OFFLINE"}
                      </span>
                    </div>
                    {(estado?.camaras ?? []).map((cam) => {
                      const activa = isCamaraActiva(cam, estado?.ultimo_heartbeat ?? null);
                      return (
                        <div key={cam.camera_id} className="flex items-center justify-between p-5">
                          <div className="flex items-center gap-3">
                            <Video className="w-5 h-5 text-blue-400" />
                            <div>
                              <span className="text-sm font-medium">{cam.camera_id === "entrada_principal" ? "Cámara Principal" : "Cámara Secundaria"}</span>
                              <span className="text-[9px] ml-2 px-1.5 py-0.5 rounded bg-white/5 text-dg-text-muted font-bold">{cam.camera_type}</span>
                            </div>
                          </div>
                          <span className={`text-xs font-bold flex items-center gap-1 ${activa ? 'text-dg-accent' : 'text-dg-error'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${activa ? 'bg-dg-accent animate-pulse' : 'bg-dg-error'}`} />
                            {activa ? "ACTIVA" : "INACTIVA"}
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between p-5">
                      <div className="flex items-center gap-3">
                        <History className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-medium">Último evento</span>
                      </div>
                      <span className="text-xs text-dg-text-muted">{ultimoEvento}</span>
                    </div>
                    <div className="flex items-center justify-between p-5">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-medium">Usuarios registrados</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-dg-accent/20 text-dg-accent">{stats.totalUsuarios}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Latest Events */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold font-headline">Últimos Eventos</h2>
                  <button 
                    onClick={() => navigate("/history")}
                    className="text-xs font-bold text-dg-accent uppercase tracking-wider"
                  >
                    Ver todo
                  </button>
                </div>
                <div className="space-y-3">
                  {events.length === 0 ? (
                    <div className="cyber-card p-8 text-center text-dg-text-muted">
                      <p className="text-sm">No hay eventos registrados aún</p>
                    </div>
                  ) : (
                    events.map((evento) => {
                      const config = getEventConfig(evento);
                      return (
                        <motion.div
                          key={evento.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => navigate(`/event/${evento.id}`)}
                          className={`cyber-card p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors`}
                        >
                          <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                            <config.icon className={`w-7 h-7 ${config.color}`} />
                          </div>
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <p className={`text-base font-semibold ${config.color}`}>{config.title}</p>
                              <div className="flex items-center gap-2 shrink-0">
                                {evento.camera_id && (
                                  <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                    evento.camera_type === "3D"
                                      ? "bg-dg-accent/10 text-dg-accent"
                                      : "bg-blue-500/10 text-blue-400"
                                  }`}>
                                    {evento.camera_id === "entrada_principal" ? "CAM-01" : "CAM-02"} · {evento.camera_type}
                                  </span>
                                )}
                                <span className="text-[10px] text-dg-text-muted">{formatTime(evento.timestamp)}</span>
                              </div>
                            </div>
                            <p className="text-sm text-dg-text-muted">{config.sub}</p>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </main>

      <Navigation />
    </div>
  );
}
