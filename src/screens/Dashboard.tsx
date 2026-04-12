import { useNavigate } from "react-router-dom";
import { LogOut, CheckCircle, AlertTriangle, HelpCircle, Video, History, Users, Settings } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";

export default function Dashboard() {
  const navigate = useNavigate();

  const stats = [
    { label: "Accesos", value: "24", sub: "hoy", icon: CheckCircle, color: "text-dg-success" },
    { label: "Fraudes", value: "3", sub: "", icon: AlertTriangle, color: "text-dg-error" },
    { label: "Desconocidos", value: "3", sub: "hoy", icon: HelpCircle, color: "text-yellow-500" },
  ];

  const events = [
    { id: 1, type: "authorized", title: "Acceso Autorizado", sub: "Juan Pérez — 87% confianza", time: "14:22", icon: CheckCircle, color: "text-dg-success", path: "/event/authorized" },
    { id: 2, type: "fraud", title: "Intento de Fraude", sub: "Superficie plana detectada", time: "14:15", icon: AlertTriangle, color: "text-dg-error", path: "/event/fraud" },
    { id: 3, type: "unknown", title: "Desconocido Detectado", sub: "Persona no registrada", time: "13:58", icon: HelpCircle, color: "text-yellow-500", path: "/event/unknown", border: true },
  ];

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-dg-accent" />
            <h1 className="text-xl font-bold tracking-tight font-headline">Inicio</h1>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-6 max-w-7xl mx-auto w-full">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat, i) => (
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
                    <Video className="w-5 h-5 text-blue-400" />
                    <span className="text-sm font-medium">Cámara</span>
                  </div>
                  <span className="text-xs font-bold text-dg-accent flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-dg-accent animate-pulse" /> ACTIVA
                  </span>
                </div>
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-3">
                    <History className="w-5 h-5 text-blue-400" />
                    <span className="text-sm font-medium">Último evento</span>
                  </div>
                  <span className="text-xs text-dg-text-muted">Hace 2 min</span>
                </div>
                <div className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-blue-400" />
                    <span className="text-sm font-medium">Usuarios registrados</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-dg-accent/20 text-dg-accent">8</span>
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
              {events.map((event) => (
                <motion.div
                  key={event.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate(event.path)}
                  className={`cyber-card p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors ${event.border ? 'border-l-4 border-l-yellow-500' : ''}`}
                >
                  <div className={`w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0`}>
                    <event.icon className={`w-7 h-7 ${event.color}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className={`text-base font-semibold ${event.color}`}>{event.title}</p>
                      <span className="text-[10px] text-dg-text-muted">{event.time}</span>
                    </div>
                    <p className="text-sm text-dg-text-muted">{event.sub}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <Navigation />
    </div>
  );
}
