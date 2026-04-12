import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Search, SlidersHorizontal, CheckCircle, AlertTriangle, HelpCircle, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";

export default function History() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");

  const events = [
    { id: 1, type: "authorized", title: "Juan Pérez", sub: "Confianza: 98%", time: "10:45 AM", icon: CheckCircle, color: "text-dg-success", path: "/event/authorized" },
    { id: 2, type: "fraud", title: "Intento de Fraude", sub: "Superficie plana detectada", time: "09:12 AM", icon: AlertTriangle, color: "text-dg-error", path: "/event/fraud", highlight: true },
    { id: 3, type: "unknown", title: "Desconocido", sub: "Sin coincidencia en base de datos", time: "08:30 AM", icon: HelpCircle, color: "text-yellow-500", path: "/event/unknown" },
    { id: 4, type: "authorized", title: "María García", sub: "Confianza: 94%", time: "07:55 AM", icon: CheckCircle, color: "text-dg-success", path: "/event/authorized" },
  ];

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           event.sub.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = activeFilter === "Todos" || 
                           (activeFilter === "Autorizados" && event.type === "authorized") ||
                           (activeFilter === "Fraude" && event.type === "fraud") ||
                           (activeFilter === "Desconocido" && event.type === "unknown");
      
      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, activeFilter]);

  return (
    <div className="min-h-screen pb-24 flex flex-col">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-dg-accent" />
              <h1 className="text-xl font-bold tracking-tight font-headline">Historial</h1>
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
        <div className="text-xs font-bold text-dg-text-muted uppercase tracking-wider mb-2">Hoy - 24 Oct, 2026</div>
        
        {filteredEvents.length > 0 ? (
          filteredEvents.map((event) => (
            <motion.div
              key={event.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(event.path)}
              className={`cyber-card p-4 flex items-center gap-4 shadow-sm cursor-pointer ${event.highlight ? 'border-dg-accent/30 ring-1 ring-dg-accent/10' : ''}`}
            >
              <div className={`w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0`}>
                <event.icon className={`w-8 h-8 ${event.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-white truncate">{event.title}</h3>
                  <span className="text-[10px] font-medium text-dg-text-muted">{event.time}</span>
                </div>
                <p className="text-xs text-dg-text-muted truncate">{event.sub}</p>
                <button className="mt-2 text-xs font-bold text-dg-accent flex items-center gap-1">
                  Ver detalles <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-12 text-dg-text-muted">
            <p className="text-sm">No se encontraron eventos que coincidan</p>
          </div>
        )}

        {searchQuery === "" && activeFilter === "Todos" && (
          <>
            <div className="text-xs font-bold text-dg-text-muted uppercase tracking-wider mt-6 mb-2">Ayer - 23 Oct, 2026</div>
            <div className="opacity-60 grayscale-[0.5]">
              <div className="cyber-card p-4 flex items-center gap-4 mb-3">
                <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                  <CheckCircle className="w-8 h-8 text-dg-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-white truncate">Carlos Ruiz</h3>
                    <span className="text-[10px] font-medium text-dg-text-muted">11:20 PM</span>
                  </div>
                  <p className="text-xs text-dg-text-muted truncate">Confianza: 87%</p>
                </div>
              </div>
            </div>
          </>
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
