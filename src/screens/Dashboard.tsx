import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, AlertTriangle, HelpCircle, Video, History, Users, Home, Server, FilterX } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";
import { supabase, getEstadisticasHoy, getUltimosEventos, getEstadoSistema, isEdgeOnline, isCamaraActiva, getTendenciasSemanales, type Evento, type EstadoSistema } from "../lib/supabase";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ accesos: 0, fraudes: 0, desconocidos: 0, totalUsuarios: 0 });
  const [events, setEvents] = useState<Evento[]>([]);
  const [ultimoEvento, setUltimoEvento] = useState<string>("—");
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [rawTendencias, setRawTendencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para filtros cruzados
  const [filtroDia, setFiltroDia] = useState<string | null>(null);
  const [filtroMotivo, setFiltroMotivo] = useState<string | null>(null);
  const [filtroHora, setFiltroHora] = useState<number | null>(null);
  const [origenFiltro, setOrigenFiltro] = useState<'tendencia' | 'heatmap' | 'dona' | null>(null);

  // Cargar datos iniciales (Raw Data)
  useEffect(() => {
    async function cargarDatos() {
      try {
        const [estadisticas, ultimos, tendenciasData] = await Promise.all([
          getEstadisticasHoy(),
          getUltimosEventos(6),
          getTendenciasSemanales()
        ]);
        setStats(estadisticas);
        setEvents(ultimos);
        setRawTendencias(tendenciasData);

        if (ultimos.length > 0) {
          const diff = Date.now() - new Date(ultimos[0].timestamp).getTime();
          const mins = Math.floor(diff / 60000);
          setUltimoEvento(mins < 1 ? "Ahora" : mins < 60 ? `Hace ${mins} min` : `Hace ${Math.floor(mins / 60)}h`);
        }

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

  // Motor de Agrupación con Filtros Cruzados
  const { tendencias, heatmapMatrix, motivosFraude, hasFilters, filteredKPIs } = useMemo(() => {
    const hasFilters = filtroDia !== null || filtroMotivo !== null || filtroHora !== null;
    if (rawTendencias.length === 0) return { tendencias: [], heatmapMatrix: { matrix: [], max: 0 }, motivosFraude: [], hasFilters, filteredKPIs: null };

    let sumAccesos = 0;
    let sumFraudes = 0;
    let sumDesconocidos = 0;

    const diasMap: Record<string, { accesos: number, fraudes: number, desconocidos: number }> = {};
    const motivosCount: Record<string, number> = {};
    const nombresDias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const matrixData: { dia: string; horas: number[] }[] = [];
    
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const diaName = nombresDias[d.getDay()];
        diasMap[diaName] = { accesos: 0, fraudes: 0, desconocidos: 0 };
        matrixData.push({ dia: diaName, horas: new Array(24).fill(0) });
    }

    rawTendencias.forEach(ev => {
        const date = new Date(ev.timestamp);
        const diaName = nombresDias[date.getDay()];
        const hora = date.getHours();
        const motivo = ev.motivo || "Desconocido";

        const pasaFiltroDia = filtroDia ? diaName === filtroDia : true;
        const pasaFiltroMotivo = filtroMotivo ? (ev.estado === "FRAUDE" && motivo === filtroMotivo) : true;
        const pasaFiltroHora = filtroHora !== null ? hora === filtroHora : true;

        if (pasaFiltroMotivo && pasaFiltroHora && diasMap[diaName]) {
            if (ev.estado === "ACCESO_PERMITIDO") diasMap[diaName].accesos++;
            if (ev.estado === "FRAUDE") diasMap[diaName].fraudes++;
            if (ev.estado === "DESCONOCIDO") diasMap[diaName].desconocidos++;
        }

        if (pasaFiltroDia && pasaFiltroMotivo) {
            const diaRow = matrixData.find(d => d.dia === diaName);
            if (diaRow) diaRow.horas[hora]++;
        }

        if (pasaFiltroDia && pasaFiltroHora && ev.estado === "FRAUDE") {
            motivosCount[motivo] = (motivosCount[motivo] || 0) + 1;
        }

        if (hasFilters && pasaFiltroDia && pasaFiltroHora && pasaFiltroMotivo) {
            if (ev.estado === "ACCESO_PERMITIDO") sumAccesos++;
            if (ev.estado === "FRAUDE") sumFraudes++;
            if (ev.estado === "DESCONOCIDO") sumDesconocidos++;
        }
    });

    let maxHeat = 0;
    matrixData.forEach(row => {
        row.horas.forEach(count => {
            if (count > maxHeat) maxHeat = count;
        });
    });

    const DONUT_COLORS = ['#f87171', '#fb923c', '#facc15', '#f43f5e', '#ef4444'];
    const motivosArr = Object.keys(motivosCount).map((key, index) => ({
       name: key,
       value: motivosCount[key],
       color: DONUT_COLORS[index % DONUT_COLORS.length]
    })).sort((a, b) => b.value - a.value);

    return {
       tendencias: Object.keys(diasMap).map(k => ({ date: k, ...diasMap[k] })),
       heatmapMatrix: { matrix: matrixData, max: maxHeat },
       motivosFraude: motivosArr,
       hasFilters,
       filteredKPIs: hasFilters ? { accesos: sumAccesos, fraudes: sumFraudes, desconocidos: sumDesconocidos } : null
    };
  }, [rawTendencias, filtroDia, filtroMotivo, filtroHora]);

  const limpiarFiltros = () => {
    setFiltroDia(null);
    setFiltroMotivo(null);
    setFiltroHora(null);
  };

  // Suscripción en tiempo real al historial
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "historial" },
        (payload) => {
          const nuevoEvento = payload.new as Evento;
          setEvents((prev) => [nuevoEvento, ...prev].slice(0, 6));
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

  const activeStats = filteredKPIs || stats;
  const activeSub = filteredKPIs ? "filtrado" : "hoy";

  const statsConfig = [
    { label: "Accesos", value: activeStats.accesos, sub: activeSub, icon: CheckCircle, color: "text-dg-success" },
    { label: "Fraudes", value: activeStats.fraudes, sub: activeSub, icon: AlertTriangle, color: "text-dg-error" },
    { label: "Desconocidos", value: activeStats.desconocidos, sub: activeSub, icon: HelpCircle, color: "text-yellow-500" },
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
    return new Date(timestamp).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: true });
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
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
              {statsConfig.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="cyber-card py-4 px-2 sm:p-4 flex flex-col items-center sm:items-stretch justify-center h-full"
                >
                  {/* Vista Móvil (Centrado, más espacio vertical) */}
                  <div className="flex sm:hidden flex-col items-center justify-center gap-1.5">
                    <stat.icon className={`w-6 h-6 ${stat.color} opacity-90 mb-1`} />
                    <span className={`text-2xl font-bold leading-none ${stat.color}`}>{stat.value}</span>
                    <span className="text-[10px] uppercase tracking-widest text-dg-text-muted font-bold text-center leading-tight">{stat.label}</span>
                  </div>

                  {/* Vista Escritorio (Premium Layout) */}
                  <div className="hidden sm:flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase tracking-widest text-dg-text-muted font-bold leading-none mb-1.5">{stat.label}</span>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-bold leading-none ${stat.color}`}>{stat.value}</span>
                        {stat.sub && <span className="text-[10px] text-dg-text-muted font-medium">{stat.sub}</span>}
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                      <stat.icon className={`w-7 h-7 ${stat.color}`} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráficos Semanales */}
              <section className="space-y-4 order-2 lg:order-1 flex flex-col">

                <div className="cyber-card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-dg-text-muted">Tendencia Semanal {filtroDia && <span className="text-dg-accent ml-2">(Filtrado: {filtroDia})</span>}</h2>
                    <button onClick={() => { setFiltroDia(null); setOrigenFiltro(null); }} className={`text-dg-accent hover:text-white transition-colors p-1 bg-dg-accent/10 rounded-md hover:bg-dg-error hover:bg-opacity-20 hover:text-dg-error ${origenFiltro === 'tendencia' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} title="Limpiar filtro">
                      <FilterX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%" className="focus:outline-none">
                      <AreaChart style={{ outline: 'none' }} data={tendencias} margin={{ top: 5, right: 0, left: -20, bottom: 0 }} onClick={(e: any) => { 
                        if (origenFiltro && origenFiltro !== 'tendencia') return;
                        if(e && e.activeLabel) {
                          setFiltroDia(prev => {
                            const next = prev === e.activeLabel ? null : e.activeLabel;
                            setOrigenFiltro(next ? 'tendencia' : null);
                            return next;
                          });
                        }
                      }}>
                        <defs>
                          <linearGradient id="colorAccesos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#4ade80" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorFraudes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f87171" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorDesconocidos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#888', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={false} contentStyle={{ backgroundColor: '#0f0f23', border: '1px solid #2a2a4a', borderRadius: '8px', fontSize: '12px' }} />
                        <Area type="monotone" dataKey="accesos" name="Accesos" stroke="#4ade80" fillOpacity={1} fill="url(#colorAccesos)" className="cursor-pointer" activeDot={false} />
                        <Area type="monotone" dataKey="fraudes" name="Fraudes" stroke="#f87171" fillOpacity={1} fill="url(#colorFraudes)" className="cursor-pointer" activeDot={false} />
                        <Area type="monotone" dataKey="desconocidos" name="Desconocidos" stroke="#eab308" fillOpacity={1} fill="url(#colorDesconocidos)" className="cursor-pointer" activeDot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="cyber-card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-dg-text-muted">Actividad por Horas {filtroHora !== null && <span className="text-dg-accent ml-2">(Filtrado: {filtroHora}:00)</span>}</h2>
                    <button onClick={() => {setFiltroHora(null); setFiltroDia(null); setOrigenFiltro(null);}} className={`text-dg-accent hover:text-white transition-colors p-1 bg-dg-accent/10 rounded-md hover:bg-dg-error hover:bg-opacity-20 hover:text-dg-error ${origenFiltro === 'heatmap' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} title="Limpiar filtro">
                      <FilterX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="w-full overflow-x-auto no-scrollbar pb-2 relative">
                    {heatmapMatrix.matrix.length === 0 ? (
                      <div className="h-32 flex items-center justify-center text-dg-text-muted text-xs">Sin datos recientes</div>
                    ) : (
                      <div className="min-w-[600px] flex flex-col gap-1">
                        {/* Eje X: Horas */}
                        <div className="flex pl-8 text-[10px] text-dg-text-muted mb-1 font-mono tracking-tighter">
                          {[...Array(24)].map((_, i) => {
                             const ampm = i >= 12 ? 'PM' : 'AM';
                             const hora = i % 12 || 12;
                             return (
                               <div 
                                 key={i} 
                                 className={`flex-1 text-center cursor-pointer transition-all ${filtroHora === i ? 'opacity-100 font-bold text-white bg-white/10 rounded' : 'opacity-60 hover:opacity-100'} ${origenFiltro && origenFiltro !== 'heatmap' ? 'pointer-events-none opacity-30' : ''}`}
                                 onClick={() => {
                                   if (origenFiltro && origenFiltro !== 'heatmap') return;
                                   setFiltroHora(prev => {
                                     const next = prev === i ? null : i;
                                     if (!next && !filtroDia) setOrigenFiltro(null);
                                     else setOrigenFiltro('heatmap');
                                     return next;
                                   });
                                 }}
                               >
                                 {i % 4 === 0 ? `${hora}${ampm}` : ''}
                               </div>
                             );
                          })}
                        </div>
                        
                        {/* Filas: Días */}
                        {heatmapMatrix.matrix.map((row) => (
                          <div key={row.dia} className="flex gap-1 items-center">
                            <span 
                              className={`w-8 text-[10px] text-dg-text-muted font-bold text-right pr-1.5 uppercase cursor-pointer hover:text-white transition-colors ${filtroDia === row.dia ? 'text-white' : ''} ${origenFiltro && origenFiltro !== 'heatmap' ? 'pointer-events-none opacity-30' : ''}`}
                              onClick={() => {
                                if (origenFiltro && origenFiltro !== 'heatmap') return;
                                setFiltroDia(prev => {
                                  const next = prev === row.dia ? null : row.dia;
                                  if (!next && !filtroHora) setOrigenFiltro(null);
                                  else setOrigenFiltro('heatmap');
                                  return next;
                                });
                              }}
                            >
                              {row.dia}
                            </span>
                            <div className="flex-1 flex gap-1">
                              {row.horas.map((count, j) => {
                                 const baseOpacity = count === 0 ? 0.05 : Math.max(0.25, count / heatmapMatrix.max);
                                 const ampm = j >= 12 ? 'PM' : 'AM';
                                 const hora = j % 12 || 12;
                                 return (
                                    <div 
                                      key={j} 
                                      onClick={() => {
                                        if (origenFiltro && origenFiltro !== 'heatmap') return;
                                        let nextDia = row.dia;
                                        let nextHora = j;
                                        setFiltroDia(prev => {
                                          nextDia = prev === row.dia ? null : row.dia;
                                          return nextDia;
                                        });
                                        setFiltroHora(prev => {
                                          nextHora = prev === j ? null : j;
                                          if (!nextDia && nextHora === null) setOrigenFiltro(null);
                                          else setOrigenFiltro('heatmap');
                                          return nextHora;
                                        });
                                      }}
                                      className={`flex-1 aspect-square rounded-[3px] bg-[#4ade80] transition-all duration-300 hover:ring-1 hover:ring-white cursor-crosshair relative group ${filtroDia === row.dia && filtroHora === j ? 'ring-2 ring-white z-10' : ''} ${origenFiltro && origenFiltro !== 'heatmap' ? 'pointer-events-none opacity-30' : ''}`}
                                      style={{ opacity: baseOpacity }}
                                    >
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-[#0f0f23] border border-[#2a2a4a] text-white text-[10px] rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">
                                        <span className="font-bold text-[#4ade80]">{count} Eventos</span> <span className="opacity-50">el</span> {row.dia} <span className="opacity-50">a las</span> {hora}:00 {ampm}
                                      </div>
                                    </div>
                                 );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Indicador de scroll en móvil */}
                    <div className="absolute right-0 top-0 bottom-2 w-6 bg-gradient-to-l from-dg-card to-transparent pointer-events-none lg:hidden" />
                  </div>
                </div>

                {/* Donut Chart: Vectores de Ataque */}
                <div className="cyber-card p-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-dg-text-muted">Vectores de Ataque</h2>
                    <button onClick={() => { setFiltroMotivo(null); setOrigenFiltro(null); }} className={`text-dg-accent hover:text-white transition-colors p-1 bg-dg-accent/10 rounded-md hover:bg-dg-error hover:bg-opacity-20 hover:text-dg-error ${origenFiltro === 'dona' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} title="Limpiar filtro">
                      <FilterX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="h-auto md:h-40 w-full flex flex-col md:flex-row items-center gap-6 md:gap-0 flex-1 justify-center">
                    {motivosFraude.length === 0 ? (
                      <div className="w-full h-40 md:h-full flex items-center justify-center text-dg-text-muted text-xs">Sin fraudes registrados</div>
                    ) : (
                      <>
                        <div className="w-full md:w-[45%] h-40 md:h-full relative shrink-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={motivosFraude}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={75}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                                onClick={(entry) => {
                                  if (origenFiltro && origenFiltro !== 'dona') return;
                                  setFiltroMotivo(prev => {
                                    const next = prev === entry.name ? null : entry.name;
                                    setOrigenFiltro(next ? 'dona' : null);
                                    return next;
                                  });
                                }}
                                className={`cursor-pointer ${origenFiltro && origenFiltro !== 'dona' ? 'pointer-events-none' : ''}`}
                              >
                                {motivosFraude.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} opacity={filtroMotivo && filtroMotivo !== entry.name ? 0.3 : 1} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#0f0f23', border: '1px solid #2a2a4a', borderRadius: '8px', fontSize: '12px' }} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-2xl font-bold text-white leading-none">
                              {motivosFraude.reduce((acc, curr) => acc + curr.value, 0)}
                            </span>
                            <span className="text-[10px] text-dg-text-muted uppercase font-bold tracking-widest mt-1">Total</span>
                          </div>
                        </div>
                        <div className="w-full md:w-[55%] flex flex-col justify-center gap-1 md:pl-6 lg:pl-8 md:pr-6 lg:pr-12">
                          {motivosFraude.map((m, i) => {
                            const total = motivosFraude.reduce((acc, curr) => acc + curr.value, 0);
                            const porcentaje = total > 0 ? Math.round((m.value / total) * 100) : 0;
                            return (
                              <div 
                                key={i} 
                                className={`flex flex-col gap-1 cursor-pointer hover:bg-white/5 py-1 px-2 -mx-2 rounded-md transition-colors ${filtroMotivo && filtroMotivo !== m.name ? 'opacity-30' : ''} ${origenFiltro && origenFiltro !== 'dona' ? 'pointer-events-none opacity-30' : ''}`}
                                onClick={() => {
                                  if (origenFiltro && origenFiltro !== 'dona') return;
                                  setFiltroMotivo(prev => {
                                    const next = prev === m.name ? null : m.name;
                                    setOrigenFiltro(next ? 'dona' : null);
                                    return next;
                                  });
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] text-dg-text-muted font-bold uppercase tracking-wider">{m.name}</span>
                                  <span className="text-xs font-bold text-white">{m.value} <span className="text-[10px] text-dg-text-muted font-normal ml-1">({porcentaje}%)</span></span>
                                </div>
                                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${porcentaje}%`, backgroundColor: m.color }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* Status and Latest */}
              <section className="space-y-4 order-1 lg:order-2 flex flex-col">
                <div className="cyber-card overflow-hidden">
                  <div className="px-4 pt-4 pb-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-dg-text-muted">Estado del Sistema</h2>
                  </div>
                  <div className="divide-y divide-dg-border">
                    <div className="flex items-center justify-between p-3 px-4">
                      <div className="flex items-center gap-3">
                        <Server className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-medium">Nodo Edge</span>
                      </div>
                      <span className={`text-xs font-bold flex items-center gap-1 ${isEdgeOnline(estado?.ultimo_heartbeat ?? null) ? 'text-dg-accent' : 'text-dg-error'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isEdgeOnline(estado?.ultimo_heartbeat ?? null) ? 'bg-dg-accent animate-pulse' : 'bg-dg-error'}`} />
                        {isEdgeOnline(estado?.ultimo_heartbeat ?? null) ? "ONLINE" : "OFFLINE"}
                      </span>
                    </div>
                    {(() => {
                      const cam = (estado?.camaras ?? [])[0];
                      if (!cam) return null;
                      const activa = isCamaraActiva(cam, estado?.ultimo_heartbeat ?? null);
                      return (
                        <div className="flex items-center justify-between p-3 px-4">
                          <div className="flex items-center gap-3">
                            <Video className="w-5 h-5 text-blue-400" />
                            <div>
                              <span className="text-sm font-medium">Cámara</span>
                              <span className="text-[8px] ml-2 px-1.5 py-0.5 rounded bg-white/5 text-dg-text-muted font-bold">{cam.camera_type}</span>
                            </div>
                          </div>
                          <span className={`text-xs font-bold flex items-center gap-1 ${activa ? 'text-dg-accent' : 'text-dg-error'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${activa ? 'bg-dg-accent animate-pulse' : 'bg-dg-error'}`} />
                            {activa ? "ACTIVA" : "INACTIVA"}
                          </span>
                        </div>
                      );
                    })()}
                    <div className="flex items-center justify-between p-3 px-4">
                      <div className="flex items-center gap-3">
                        <History className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-medium">Último evento</span>
                      </div>
                      <span className="text-xs text-dg-text-muted">{ultimoEvento}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 px-4">
                      <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-blue-400" />
                        <span className="text-sm font-medium">Usuarios registrados</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-dg-accent/20 text-dg-accent">{stats.totalUsuarios}</span>
                    </div>
                  </div>
                </div>

                {/* Latest Events */}
                <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-dg-text-muted">Últimos Eventos</h2>
                  <button 
                    onClick={() => navigate("/history")}
                    className="text-xs font-bold text-dg-accent uppercase tracking-widest"
                  >
                    Ver todo
                  </button>
                </div>
                <div className="space-y-3 flex-1">
                  {events.length === 0 ? (
                    <div className="cyber-card p-8 text-center text-dg-text-muted">
                      <p className="text-sm">No hay eventos registrados aún</p>
                    </div>
                  ) : (
                    events.map((evento, idx) => {
                      const config = getEventConfig(evento);
                      return (
                        <motion.div
                          key={evento.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => navigate(`/event/${evento.id}`)}
                          className={`cyber-card p-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors ${idx >= 3 ? 'hidden lg:flex' : ''}`}
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
