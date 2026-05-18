import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, CheckCircle, AlertTriangle, HelpCircle, ChevronRight, History as HistoryIcon } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";
import { getHistorial, type Evento, type EstadoEvento } from "../lib/supabase";

export default function History() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"Todos" | "Autorizados" | "Fraude" | "Desconocido">("Todos");
  const [events, setEvents] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      setLoading(true);
      try {
        const filtroMap: Record<string, EstadoEvento | undefined> = {
          Todos: undefined,
          Autorizados: "ACCESO_PERMITIDO",
          Fraude: "FRAUDE",
          Desconocido: "DESCONOCIDO",
        };
        const data = await getHistorial(filtroMap[activeFilter], searchQuery || undefined);
        setEvents(data);
      } catch (err) {
        console.error("Error cargando historial:", err);
      } finally {
        setLoading(false);
      }
    }
    // Debounce la búsqueda
    const timer = setTimeout(cargar, 300);
    return () => clearTimeout(timer);
  }, [activeFilter, searchQuery]);

  function getEventConfig(evento: Evento) {
    switch (evento.estado) {
      case "ACCESO_PERMITIDO":
        return { title: evento.nombre ?? "Usuario", sub: `Confianza: ${Math.round((evento.confianza ?? 0) * 100)}%`, icon: CheckCircle, color: "text-dg-success", highlight: false };
      case "FRAUDE":
        return { title: "Intento de Fraude", sub: evento.motivo ?? "Superficie plana detectada", icon: AlertTriangle, color: "text-dg-error", highlight: true };
      case "DESCONOCIDO":
        return { title: "Desconocido", sub: evento.motivo ?? "Sin coincidencia en base de datos", icon: HelpCircle, color: "text-yellow-500", highlight: false };
    }
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  function formatDate(timestamp: string) {
    const date = new Date(timestamp);
    const hoy = new Date();
    const ayer = new Date();
    ayer.setDate(ayer.getDate() - 1);

    if (date.toDateString() === hoy.toDateString()) return "Hoy";
    if (date.toDateString() === ayer.toDateString()) return "Ayer";
    return date.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
  }

  // Agrupar eventos por fecha
  const groupedEvents = events.reduce<Record<string, Evento[]>>((acc, evento) => {
    const dateKey = formatDate(evento.timestamp);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(evento);
    return acc;
  }, {});

  return (
    <div className="min-h-screen pb-24 flex flex-col">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <HistoryIcon className="w-6 h-6 text-dg-accent" />
              <h1 className="text-xl font-bold font-headline">Historial</h1>
            </div>
          </div>
          
          <div className="px-4 pb-4 space-y-3">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dg-text-muted w-4 h-4" />
              <input 
                type="text" 
                placeholder="Buscar accesos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-dg-card border-none rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-dg-accent/50 placeholder:text-dg-text-muted"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <FilterChip label="Todos" active={activeFilter === "Todos"} onClick={() => setActiveFilter("Todos")} />
              <FilterChip label="Autorizados" icon={CheckCircle} iconColor="text-dg-success" active={activeFilter === "Autorizados"} onClick={() => setActiveFilter("Autorizados")} />
              <FilterChip label="Fraude" icon={AlertTriangle} iconColor="text-dg-error" active={activeFilter === "Fraude"} onClick={() => setActiveFilter("Fraude")} />
              <FilterChip label="Desconocido" icon={HelpCircle} iconColor="text-yellow-500" active={activeFilter === "Desconocido"} onClick={() => setActiveFilter("Desconocido")} />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-dg-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-dg-text-muted">
            <p className="text-sm">No se encontraron eventos que coincidan</p>
          </div>
        ) : (
          (Object.entries(groupedEvents) as [string, Evento[]][]).map(([dateLabel, dateEvents]) => (
            <div key={dateLabel}>
              <div className="text-xs font-bold text-dg-text-muted mb-2 mt-4">{dateLabel}</div>
              {dateEvents.map((evento) => {
                const config = getEventConfig(evento);
                return (
                  <motion.div
                    key={evento.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate(`/event/${evento.id}`)}
                    className={`cyber-card p-4 flex items-center gap-4 shadow-sm cursor-pointer mb-3 ${config.highlight ? 'border-dg-accent/30 ring-1 ring-dg-accent/10' : ''}`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <config.icon className={`w-8 h-8 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-white truncate">{config.title}</h3>
                        <span className="text-[10px] font-medium text-dg-text-muted">{formatTime(evento.timestamp)}</span>
                      </div>
                      <p className="text-xs text-dg-text-muted truncate">{config.sub}</p>
                      <button className="mt-2 text-xs font-bold text-dg-accent flex items-center gap-1">
                        Ver detalles <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}
      </main>

      <Navigation />
    </div>
  );
}

function FilterChip({ label, active, icon: Icon, iconColor, onClick }: { label: string, active?: boolean, icon?: any, iconColor?: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
      active 
        ? "bg-dg-accent text-dg-bg font-bold" 
        : "bg-dg-card border border-dg-border text-dg-text-muted hover:border-dg-accent/50"
    }`}>
      {Icon && <Icon className={`w-3.5 h-3.5 ${active ? "text-dg-bg" : iconColor}`} />}
      {label}
    </button>
  );
}
