import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, CheckCircle, AlertTriangle, HelpCircle, ChevronRight, History as HistoryIcon, Download, Calendar, X } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";
import { getHistorialPaginado, type Evento, type EstadoEvento } from "../lib/supabase";
import { exportToCSV } from "../lib/exportUtils";

export default function History() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"Todos" | "Autorizados" | "Fraude" | "Desconocido">("Todos");
  const [events, setEvents] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const limit = 50;

  const hasFechaFilter = fechaDesde !== "" || fechaHasta !== "";

  useEffect(() => {
    async function cargarInicial() {
      setLoading(true);
      setPage(0);
      try {
        const filtroMap: Record<string, EstadoEvento | undefined> = {
          Todos: undefined,
          Autorizados: "ACCESO_PERMITIDO",
          Fraude: "FRAUDE",
          Desconocido: "DESCONOCIDO",
        };
        const res = await getHistorialPaginado(0, limit, filtroMap[activeFilter], searchQuery || undefined, fechaDesde || undefined, fechaHasta || undefined);
        setEvents(res.data);
        setHasMore(res.data.length === limit);
      } catch (err) {
        console.error("Error cargando historial:", err);
      } finally {
        setLoading(false);
      }
    }
    // Debounce la búsqueda
    const timer = setTimeout(cargarInicial, 300);
    return () => clearTimeout(timer);
  }, [activeFilter, searchQuery, fechaDesde, fechaHasta]);

  async function cargarMas() {
    const nextPg = page + 1;
    try {
      const filtroMap: Record<string, EstadoEvento | undefined> = {
        Todos: undefined,
        Autorizados: "ACCESO_PERMITIDO",
        Fraude: "FRAUDE",
        Desconocido: "DESCONOCIDO",
      };
      const res = await getHistorialPaginado(nextPg, limit, filtroMap[activeFilter], searchQuery || undefined, fechaDesde || undefined, fechaHasta || undefined);
      setEvents(prev => [...prev, ...res.data]);
      setPage(nextPg);
      setHasMore(res.data.length === limit);
    } catch (err) {
      console.error("Error cargando más eventos:", err);
    }
  }

  function handleExportCSV() {
    const filename = `historial_${activeFilter}_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(events, filename);
  }

  function getEventConfig(evento: Evento) {
    switch (evento.estado) {
      case "ACCESO_PERMITIDO":
        return { title: evento.nombre ?? "Usuario", sub: `Confianza: ${Math.round((evento.confianza ?? 0) * 100)}%`, icon: CheckCircle, color: "text-dg-success", highlight: false };
      case "FRAUDE":
        return { title: "Intento de Fraude", sub: evento.motivo ?? "Superficie plana detectada", icon: AlertTriangle, color: "text-dg-error", highlight: true };
      case "DESCONOCIDO":
        return { title: "Desconocido", sub: evento.motivo ?? "Sin coincidencia en base de datos", icon: HelpCircle, color: "text-dg-warning", highlight: false };
    }
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
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
              <HistoryIcon className="w-6 h-6 text-dg-text-secondary" aria-hidden="true" />
              <h1 className="text-xl font-bold tracking-tight font-headline">Historial</h1>
            </div>
            <button 
              onClick={handleExportCSV}
              disabled={events.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dg-card border border-dg-border text-dg-text-muted hover:text-dg-text hover:border-dg-action-text transition-all text-xs font-bold disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
          
          <div className="px-4 pb-4 space-y-3">
            <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <div className="relative flex-1 md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dg-text-muted w-4 h-4" />
                <input 
                  type="search"
                  aria-label="Buscar accesos por nombre o motivo"
                  placeholder="Buscar accesos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-dg-card border-none rounded-dg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-dg-focus/50 placeholder:text-dg-text-muted text-dg-text"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 md:flex-none">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-dg-text-muted w-4 h-4 pointer-events-none z-10" />
                  <input
                    type="date"
                    aria-label="Filtrar desde la fecha"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className={`w-full md:w-[145px] bg-dg-card border-none rounded-dg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-dg-focus/50 appearance-none [color-scheme:dark] relative [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer ${fechaDesde ? 'text-dg-text' : 'text-dg-text-muted'}`}
                    placeholder="Desde"
                  />
                </div>
                <span className="text-dg-text-muted text-sm font-medium">—</span>
                <div className="relative flex-1 md:flex-none">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-dg-text-muted w-4 h-4 pointer-events-none z-10" />
                  <input
                    type="date"
                    aria-label="Filtrar hasta la fecha"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className={`w-full md:w-[145px] bg-dg-card border-none rounded-dg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-dg-focus/50 appearance-none [color-scheme:dark] relative [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer ${fechaHasta ? 'text-dg-text' : 'text-dg-text-muted'}`}
                    placeholder="Hasta"
                  />
                </div>
                {hasFechaFilter && (
                  <button
                    onClick={() => { setFechaDesde(""); setFechaHasta(""); }}
                    className="p-2.5 rounded-dg bg-dg-error/10 text-dg-error hover:bg-dg-error/20 transition-colors shrink-0"
                    title="Limpiar fechas"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              <FilterChip label="Todos" active={activeFilter === "Todos"} onClick={() => setActiveFilter("Todos")} />
              <FilterChip label="Autorizados" icon={CheckCircle} iconColor="text-dg-success" active={activeFilter === "Autorizados"} onClick={() => setActiveFilter("Autorizados")} />
              <FilterChip label="Fraude" icon={AlertTriangle} iconColor="text-dg-error" active={activeFilter === "Fraude"} onClick={() => setActiveFilter("Fraude")} />
              <FilterChip label="Desconocido" icon={HelpCircle} iconColor="text-dg-warning" active={activeFilter === "Desconocido"} onClick={() => setActiveFilter("Desconocido")} />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-3 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-dg-info border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-dg-text-muted">
            <p className="text-sm">No se encontraron eventos que coincidan</p>
          </div>
        ) : (
          (Object.entries(groupedEvents) as [string, Evento[]][]).map(([dateLabel, dateEvents]) => (
            <div key={dateLabel}>
              <div className="text-xs font-bold text-dg-text-muted uppercase tracking-wider mb-2 mt-4">{dateLabel}</div>
              {dateEvents.map((evento) => {
                const config = getEventConfig(evento);
                return (
                  <motion.div
                    key={evento.id}
                    whileTap={{ scale: 0.98 }}
                    className={`cyber-card card-linked p-4 flex items-center gap-4 shadow-sm mb-3 relative hover:border-dg-action-text/40 transition-colors ${config.highlight ? 'border-dg-warning/40 ring-1 ring-dg-warning/10' : ''}`}
                  >
                    <div className="w-12 h-12 rounded-dg bg-white/5 flex items-center justify-center shrink-0">
                      <config.icon className={`w-8 h-8 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-dg-text truncate">{config.title}</h3>
                        <span className="text-[10px] font-medium text-dg-text-muted">{formatTime(evento.timestamp)}</span>
                      </div>
                      <p className="text-xs text-dg-text-muted truncate">{config.sub}</p>
                      <Link
                        to={`/event/${evento.id}`}
                        className="mt-2 text-xs font-bold text-dg-action-text inline-flex items-center gap-1 focus-visible:outline-none after:absolute after:inset-0 after:rounded-dg"
                      >
                        Ver detalles
                        <ChevronRight className="w-3 h-3" aria-hidden="true" />
                        <span className="sr-only">de {config.title} a las {formatTime(evento.timestamp)}</span>
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ))
        )}

        {!loading && hasMore && events.length > 0 && (
          <div className="pt-4 pb-8 flex justify-center">
            <button 
              onClick={cargarMas}
              className="px-6 py-2 rounded-full border border-dg-action-text/50 text-dg-action-text font-semibold text-sm hover:bg-dg-action-text/10 transition-colors"
            >
              Cargar más eventos
            </button>
          </div>
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
        ? "bg-dg-action text-white font-bold" 
        : "bg-dg-card border border-dg-border text-dg-text-muted hover:border-dg-action-text/50"
    }`}>
      {Icon && <Icon className={`w-3.5 h-3.5 ${active ? "text-dg-bg" : iconColor}`} />}
      {label}
    </button>
  );
}
