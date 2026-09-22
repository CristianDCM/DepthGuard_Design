import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, AlertTriangle, HelpCircle, Video, History, Users, Server, FilterX, CalendarDays, Calendar } from "lucide-react";
import Navigation from "../components/Navigation";
import { supabase, getEstadisticasHoy, getUltimosEventos, getEstadoSistema, isEdgeOnline, isCamaraActiva, getTendenciasSemanales, type Evento, type EstadoSistema } from "../lib/supabase";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";

/**
 * Tooltip de los graficos en la variante minimalista: sin radio y con
 * el mismo filete de 1px que las tarjetas.
 */
const TOOLTIP_PLANO = {
  backgroundColor: 'var(--color-dg-card)',
  border: '1px solid var(--color-dg-border)',
  borderRadius: 0,
  fontSize: '12px',
  letterSpacing: '0.8px',
} as const;

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ accesos: 0, fraudes: 0, desconocidos: 0, totalUsuarios: 0 });
  const [events, setEvents] = useState<Evento[]>([]);
  const [ultimoEvento, setUltimoEvento] = useState<string>("—");
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [rawTendencias, setRawTendencias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modoFiltro, setModoFiltro] = useState<'preset' | 'custom'>('preset');
  const [diasPreset, setDiasPreset] = useState(7);
  const [customDesde, setCustomDesde] = useState('');
  const [customHasta, setCustomHasta] = useState('');

  // Estados para filtros cruzados
  const [filtroDia, setFiltroDia] = useState<string | null>(null);
  const [filtroMotivo, setFiltroMotivo] = useState<string | null>(null);
  const [filtroHora, setFiltroHora] = useState<number | null>(null);
  const [origenFiltro, setOrigenFiltro] = useState<'tendencia' | 'heatmap' | 'dona' | null>(null);

  // Clave de dependencia para re-fetch: cambia cuando el usuario cambia de modo/preset/rango
  const fetchKey = modoFiltro === 'custom' ? `custom-${customDesde}-${customHasta}` : `preset-${diasPreset}`;

  // Cargar datos iniciales (Raw Data)
  useEffect(() => {
    // Si es custom pero faltan fechas, no hacer fetch
    if (modoFiltro === 'custom' && (!customDesde || !customHasta)) return;

    async function cargarDatos() {
      try {
        const opciones = modoFiltro === 'custom' && customDesde && customHasta
          ? { desde: customDesde, hasta: customHasta }
          : { dias: diasPreset };

        const [estadisticas, ultimos, tendenciasData] = await Promise.all([
          getEstadisticasHoy(),
          getUltimosEventos(6),
          getTendenciasSemanales(opciones)
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
  }, [fetchKey]);

  // Al cambiar período, limpiar filtros cruzados
  useEffect(() => {
    setFiltroDia(null);
    setFiltroMotivo(null);
    setFiltroHora(null);
    setOrigenFiltro(null);
  }, [fetchKey]);

  // Etiqueta legible del período activo
  const periodoLabel = useMemo(() => {
    if (modoFiltro === 'custom' && customDesde && customHasta) {
      const d = customDesde.split('-');
      const h = customHasta.split('-');
      const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      return `${parseInt(d[2])} ${meses[parseInt(d[1])-1]} — ${parseInt(h[2])} ${meses[parseInt(h[1])-1]}`;
    }
    if (diasPreset <= 7) return 'Semanal';
    if (diasPreset <= 30) return 'Mensual';
    return `${diasPreset} Días`;
  }, [modoFiltro, diasPreset, customDesde, customHasta]);

  // Motor de Agrupación con Filtros Cruzados (soporta presets y rangos personalizados)
  const { tendencias, heatmapMatrix, motivosFraude, hasFilters, filteredKPIs } = useMemo(() => {
    const hasFilters = filtroDia !== null || filtroMotivo !== null || filtroHora !== null;
    if (rawTendencias.length === 0) return { tendencias: [], heatmapMatrix: { matrix: [], max: 0 }, motivosFraude: [], hasFilters, filteredKPIs: null };

    let sumAccesos = 0;
    let sumFraudes = 0;
    let sumDesconocidos = 0;

    const diasMap: Record<string, { accesos: number, fraudes: number, desconocidos: number }> = {};
    const motivosCount: Record<string, number> = {};
    const nombresDias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const mesesCortos = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

    // Heatmap: siempre 7 filas (día de la semana), agrega cuando período > 7d
    const matrixData: { dia: string; horas: number[] }[] = nombresDias.map(d => ({ dia: d, horas: new Array(24).fill(0) }));

    // Calcular rango efectivo de fechas
    let fechaInicio: Date;
    let fechaFin: Date;
    if (modoFiltro === 'custom' && customDesde && customHasta) {
      fechaInicio = new Date(customDesde + 'T00:00:00');
      fechaFin = new Date(customHasta + 'T23:59:59');
    } else {
      fechaFin = new Date();
      fechaInicio = new Date();
      fechaInicio.setDate(fechaInicio.getDate() - (diasPreset - 1));
      fechaInicio.setHours(0, 0, 0, 0);
    }
    const diasEnRango = Math.round((fechaFin.getTime() - fechaInicio.getTime()) / 86400000) + 1;

    // AreaChart: generar etiquetas dinámicas según el rango
    const diasOrdenados: string[] = [];
    const fechaToLabel = new Map<string, string>();

    for (let i = 0; i < diasEnRango; i++) {
      const d = new Date(fechaInicio);
      d.setDate(d.getDate() + i);
      const localKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      let label: string;
      if (diasEnRango <= 7) {
        label = nombresDias[d.getDay()];
      } else if (diasEnRango <= 14) {
        label = `${nombresDias[d.getDay()]} ${d.getDate()}`;
      } else {
        label = `${d.getDate()} ${mesesCortos[d.getMonth()]}`;
      }
      diasMap[label] = { accesos: 0, fraudes: 0, desconocidos: 0 };
      diasOrdenados.push(label);
      fechaToLabel.set(localKey, label);
    }

    rawTendencias.forEach(ev => {
      const date = new Date(ev.timestamp);
      const diaName = nombresDias[date.getDay()];
      const localKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const areaLabel = fechaToLabel.get(localKey) ?? diaName;
      const hora = date.getHours();
      const motivo = ev.motivo || "Desconocido";

      // Filtro por día: si viene de 'tendencia' compara con label del AreaChart, si de 'heatmap' compara con día de la semana
      const pasaFiltroDia = filtroDia
        ? (origenFiltro === 'heatmap' ? diaName === filtroDia : areaLabel === filtroDia)
        : true;
      const pasaFiltroMotivo = filtroMotivo ? (ev.estado === "FRAUDE" && motivo === filtroMotivo) : true;
      const pasaFiltroHora = filtroHora !== null ? hora === filtroHora : true;

      // AreaChart: agrupa por label (afectado por filtro motivo y hora, no por filtroDia)
      if (pasaFiltroMotivo && pasaFiltroHora && diasMap[areaLabel]) {
        if (ev.estado === "ACCESO_PERMITIDO") diasMap[areaLabel].accesos++;
        if (ev.estado === "FRAUDE") diasMap[areaLabel].fraudes++;
        if (ev.estado === "DESCONOCIDO") diasMap[areaLabel].desconocidos++;
      }

      // Heatmap: agrupa por día de la semana (afectado por filtroDia y motivo)
      if (pasaFiltroDia && pasaFiltroMotivo) {
        const diaRow = matrixData.find(d => d.dia === diaName);
        if (diaRow) diaRow.horas[hora]++;
      }

      // Donut: filtra por día y hora
      if (pasaFiltroDia && pasaFiltroHora && ev.estado === "FRAUDE") {
        motivosCount[motivo] = (motivosCount[motivo] || 0) + 1;
      }

      // KPIs filtrados
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

    const DONUT_COLORS = [100, 78, 58, 42, 30].map(
      (pct) => `color-mix(in srgb, var(--color-dg-error) ${pct}%, var(--color-dg-card))`
    );
    const motivosArr = Object.keys(motivosCount).map((key, index) => ({
      name: key,
      value: motivosCount[key],
      color: DONUT_COLORS[index % DONUT_COLORS.length]
    })).sort((a, b) => b.value - a.value);

    return {
      tendencias: diasOrdenados.map(k => ({ date: k, ...diasMap[k] })),
      heatmapMatrix: { matrix: matrixData, max: maxHeat },
      motivosFraude: motivosArr,
      hasFilters,
      filteredKPIs: hasFilters ? { accesos: sumAccesos, fraudes: sumFraudes, desconocidos: sumDesconocidos } : null
    };
  }, [rawTendencias, filtroDia, filtroMotivo, filtroHora, modoFiltro, diasPreset, customDesde, customHasta, origenFiltro]);

  /**
   * Flechas dentro del mapa de calor (patron de tabIndex itinerante).
   *
   * Sin esto habria que pulsar Tab 168 veces para cruzar la rejilla, que
   * tecnicamente es accesible y en la practica es inutilizable.
   */
  const moverFocoRejilla = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const DELTAS: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };
    const delta = DELTAS[e.key];
    if (!delta) return;

    const activo = document.activeElement as HTMLElement | null;
    const fila = Number(activo?.dataset?.fila);
    const col = Number(activo?.dataset?.col);
    if (Number.isNaN(fila) || Number.isNaN(col)) return;

    e.preventDefault();
    const destino = e.currentTarget.querySelector<HTMLElement>(
      `[data-fila="${fila + delta[0]}"][data-col="${col + delta[1]}"]`
    );
    if (!destino) return;

    // El foco se mueve y con el la unica parada de tabulacion.
    activo!.tabIndex = -1;
    destino.tabIndex = 0;
    destino.focus();
  };

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
    { label: "Desconocidos", value: activeStats.desconocidos, sub: activeSub, icon: HelpCircle, color: "text-dg-warning" },
  ];

  function getEventConfig(evento: Evento) {
    switch (evento.estado) {
      case "ACCESO_PERMITIDO":
        return { title: "Acceso Autorizado", sub: `${evento.nombre ?? "—"} — ${Math.round((evento.confianza ?? 0) * 100)}% confianza`, icon: CheckCircle, color: "text-dg-success", border: false };
      case "FRAUDE":
        return { title: "Intento de Fraude", sub: evento.motivo ?? "Superficie plana detectada", icon: AlertTriangle, color: "text-dg-error", border: false };
      case "DESCONOCIDO":
        return { title: "Desconocido Detectado", sub: "Persona no registrada", icon: HelpCircle, color: "text-dg-warning", border: true };
      default:
        // El estado lo escribe el edge: un valor inesperado no puede dejar
        // la funcion devolviendo undefined y romper el render del listado.
        return { title: "Estado no reconocido", sub: "Revise el registro del evento", icon: HelpCircle, color: "text-dg-text-muted", border: false };
    }
  }

  function formatTime(timestamp: string) {
    return new Date(timestamp).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  return (
    // `mini` fija el interletraje de 0.8px del portafolio para toda la
    // pantalla. La paleta es la de siempre: aqui no se anade ni un color.
    <div className="mini min-h-screen flex flex-col bg-dg-bg pb-24 lg:pb-0 lg:pt-16">
      {/*
        A diferencia del resto del panel, esta pantalla SI lleva cabecera
        propia: es el banner del portafolio (rotulo, titular grande, parrafo
        gris y boton de filete), que es lo que le da su caracter. El <h1>
        pasa de sr-only a visible.
      */}
      <header className="border-b border-dg-border px-4 pb-8 pt-8 sm:pb-10 sm:pt-12">
        <div className="mx-auto w-full max-w-7xl">
          <p className="mini-eyebrow">Panel de control</p>
          <h1 className="mini-h1 mt-2">Inicio</h1>
          <p className="mini-body mt-4 max-w-2xl">
            Accesos, intentos de fraude y estado del nodo de vigilancia. Los datos se
            actualizan en vivo a medida que el borde los envia.
          </p>
          <button
            type="button"
            onClick={() => navigate("/history")}
            className="mini-btn mt-6 px-6 py-3 text-sm"
          >
            Ver historial completo
          </button>
        </div>
      </header>

      <main id="contenido" className="mx-auto w-full max-w-7xl flex-1 space-y-8 px-4 py-8">
        {loading ? (
          // Sin ruleta: el original giraba en bucle y aqui no hay animacion
          // ninguna. Un rotulo estatico dice lo mismo.
          <p
            role="status"
            className="py-20 text-center text-xs font-bold uppercase tracking-[0.8px] text-dg-text-muted"
          >
            Cargando
          </p>
        ) : (
          <>
            {/* KPIs: filete, esquina viva y la cifra como unico elemento grande */}
            <div className="grid grid-cols-3 gap-px border border-dg-border bg-dg-border">
              {statsConfig.map((stat) => (
                <div
                  key={stat.label}
                  /*
                    Rejilla de un pixel de separacion sobre fondo de borde:
                    las tres tarjetas comparten filete en vez de dibujar cada
                    una el suyo, que es como se compone una tabla plana.
                  */
                  className="flex flex-col gap-2 bg-dg-bg p-3 sm:gap-3 sm:p-6"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted sm:text-xs">
                      {stat.label}
                    </span>
                    <stat.icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${stat.color}`} />
                  </div>
                  <span className={`tabular text-3xl font-bold leading-none sm:text-4xl ${stat.color}`}>
                    {stat.value}
                  </span>
                  <span className="text-2xs uppercase tracking-[0.8px] text-dg-text-muted">
                    {stat.sub}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Gráficos Analíticos */}
              <section className="order-2 flex flex-col space-y-4 lg:order-1">

                {/* Selector de Período */}
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarDays aria-hidden="true" className="h-4 w-4 text-dg-text-muted" />
                  <span className="text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">
                    Período
                  </span>
                  <div className="ml-1 flex gap-2">
                    {([7, 30, 90] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => { setModoFiltro('preset'); setDiasPreset(p); }}
                        aria-pressed={modoFiltro === 'preset' && diasPreset === p}
                        className={`mini-btn px-3 py-1.5 text-2xs ${modoFiltro === 'preset' && diasPreset === p ? 'mini-btn-on' : ''}`}
                      >
                        {p}d
                      </button>
                    ))}
                    <button
                      onClick={() => setModoFiltro('custom')}
                      aria-pressed={modoFiltro === 'custom'}
                      className={`mini-btn flex items-center gap-1.5 px-3 py-1.5 text-2xs ${modoFiltro === 'custom' ? 'mini-btn-on' : ''}`}
                    >
                      <Calendar aria-hidden="true" className="h-3 w-3" /> Rango
                    </button>
                  </div>
                  {modoFiltro === 'custom' && (
                    <div className="ml-auto flex items-center gap-2 sm:ml-0">
                      <input
                        type="date"
                        aria-label="Inicio del período personalizado"
                        value={customDesde}
                        onChange={(e) => setCustomDesde(e.target.value)}
                        className="mini-input"
                      />
                      <span className="text-xs text-dg-text-muted">—</span>
                      <input
                        type="date"
                        aria-label="Fin del período personalizado"
                        value={customHasta}
                        onChange={(e) => setCustomHasta(e.target.value)}
                        className="mini-input"
                      />
                    </div>
                  )}
                </div>

                {/* Chips de filtros activos */}
                {(filtroDia || filtroHora !== null || filtroMotivo) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <FilterX aria-hidden="true" className="h-3.5 w-3.5 text-dg-text-muted" />
                    <span className="text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">
                      Filtros
                    </span>
                    {filtroDia && (
                      <button
                        onClick={() => { setFiltroDia(null); setOrigenFiltro(null); }}
                        className="mini-btn mini-btn-on flex items-center gap-1.5 px-2.5 py-1 text-2xs"
                      >
                        Día: {filtroDia} <span aria-hidden="true">✕</span>
                      </button>
                    )}
                    {filtroHora !== null && (
                      <button
                        onClick={() => { setFiltroHora(null); if (!filtroDia) setOrigenFiltro(null); }}
                        className="mini-btn mini-btn-on flex items-center gap-1.5 px-2.5 py-1 text-2xs"
                      >
                        Hora: {filtroHora}:00 <span aria-hidden="true">✕</span>
                      </button>
                    )}
                    {filtroMotivo && (
                      <button
                        onClick={() => { setFiltroMotivo(null); setOrigenFiltro(null); }}
                        className="mini-btn mini-btn-on flex items-center gap-1.5 px-2.5 py-1 text-2xs"
                      >
                        {filtroMotivo} <span aria-hidden="true">✕</span>
                      </button>
                    )}
                    <button
                      onClick={() => { limpiarFiltros(); setOrigenFiltro(null); }}
                      className="mini-btn px-2.5 py-1 text-2xs"
                    >
                      Limpiar todo
                    </button>
                  </div>
                )}

                <div className="mini-card p-4 sm:p-5">
                  <h2 className="mini-h2 mb-5">Tendencia {periodoLabel}</h2>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%" className="focus:outline-none">
                      {/*
                        Sin degradados, sin relleno y con `type="linear"`: tres
                        polilineas rectas. Con relleno, las tres series se
                        solapaban en una zona gris que no era de nadie, y un
                        desvanecido no es propio de este lenguaje visual.
                        `isAnimationActive={false}` apaga el dibujado
                        progresivo que Recharts hace por defecto.
                      */}
                      <AreaChart style={{ outline: 'none' }} data={tendencias} margin={{ top: 5, right: 0, left: -20, bottom: 0 }} onClick={(e: any) => {
                        if (e && e.activeLabel) {
                          setFiltroDia(prev => {
                            const next = prev === e.activeLabel ? null : e.activeLabel;
                            setOrigenFiltro(next ? 'tendencia' : (filtroHora !== null || filtroMotivo) ? origenFiltro : null);
                            return next;
                          });
                        }
                      }}>
                        <XAxis dataKey="date" tick={{ fill: 'var(--color-dg-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'var(--color-dg-text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={false} contentStyle={TOOLTIP_PLANO} />
                        <Area type="linear" dataKey="accesos" name="Accesos" stroke="var(--color-dg-success)" strokeWidth={2} fill="none" fillOpacity={0} isAnimationActive={false} className="cursor-pointer" activeDot={false} />
                        <Area type="linear" dataKey="fraudes" name="Fraudes" stroke="var(--color-dg-error)" strokeWidth={2} fill="none" fillOpacity={0} isAnimationActive={false} className="cursor-pointer" activeDot={false} />
                        <Area type="linear" dataKey="desconocidos" name="Desconocidos" stroke="var(--color-dg-warning)" strokeWidth={2} fill="none" fillOpacity={0} isAnimationActive={false} className="cursor-pointer" activeDot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mini-card p-4 sm:p-5">
                  <h2 className="mini-h2 mb-5">Patrón de Actividad ({periodoLabel})</h2>
                  <div className="relative w-full overflow-x-auto no-scrollbar pb-2">
                    {heatmapMatrix.matrix.length === 0 ? (
                      <div className="flex h-32 items-center justify-center text-xs uppercase tracking-[0.8px] text-dg-text-muted">
                        Sin datos recientes
                      </div>
                    ) : (
                      <div
                        role="grid"
                        aria-label="Eventos por día de la semana y hora"
                        className="flex min-w-[600px] flex-col gap-1"
                        /*
                          Antes las celdas, las horas y los dias eran <div> y
                          <span> con onClick: sin rol, sin tabIndex y sin
                          teclado. La analitica cruzada, que es la funcion mas
                          elaborada del panel, era inalcanzable sin raton
                          (WCAG 2.1.1).

                          Ahora es una rejilla con tabIndex itinerante: solo
                          una celda entra en el orden de tabulacion y las
                          flechas mueven el foco dentro. Tabular por 168
                          celdas para cruzar la rejilla no seria accesible,
                          seria una condena.
                        */
                        onKeyDown={moverFocoRejilla}
                      >
                        {/* Eje X: Horas */}
                        <div role="row" className="mb-1 flex pl-8 font-mono text-2xs tabular tracking-tighter text-dg-text-muted">
                          {[...Array(24)].map((_, i) => {
                            const ampm = i >= 12 ? 'PM' : 'AM';
                            const hora = i % 12 || 12;
                            const activa = filtroHora === i;
                            return (
                              <button
                                key={i}
                                type="button"
                                role="columnheader"
                                aria-pressed={activa}
                                aria-label={`Filtrar por las ${hora}:00 ${ampm}`}
                                onClick={() => setFiltroHora(prev => (prev === i ? null : i))}
                                className={`flex-1 text-center ${activa ? 'bg-dg-text font-bold text-dg-bg' : 'opacity-60 hover:opacity-100'}`}
                              >
                                {i % 4 === 0 ? `${hora}${ampm}` : <span aria-hidden="true">·</span>}
                              </button>
                            );
                          })}
                        </div>

                        {/* Filas: Días */}
                        {heatmapMatrix.matrix.map((row, filaIdx) => (
                          <div role="row" key={row.dia} className="flex items-center gap-1">
                            <button
                              type="button"
                              role="rowheader"
                              aria-pressed={filtroDia === row.dia}
                              aria-label={`Filtrar por ${row.dia}`}
                              className={`w-8 pr-1.5 text-right text-2xs font-bold uppercase tracking-[0.8px] hover:text-dg-text ${filtroDia === row.dia ? 'text-dg-text' : 'text-dg-text-muted'}`}
                              onClick={() => setFiltroDia(prev => (prev === row.dia ? null : row.dia))}
                            >
                              {row.dia}
                            </button>
                            <div className="flex flex-1 gap-1">
                              {row.horas.map((count, j) => {
                                const baseOpacity = count === 0 ? 0.05 : Math.max(0.25, count / heatmapMatrix.max);
                                const ampm = j >= 12 ? 'PM' : 'AM';
                                const hora = j % 12 || 12;
                                const seleccionada = filtroDia === row.dia && filtroHora === j;
                                return (
                                  <button
                                    key={j}
                                    type="button"
                                    role="gridcell"
                                    data-fila={filaIdx}
                                    data-col={j}
                                    // Solo la primera celda entra en el orden de
                                    // tabulacion; el resto se alcanza con flechas.
                                    tabIndex={filaIdx === 0 && j === 0 ? 0 : -1}
                                    aria-pressed={seleccionada}
                                    aria-label={`${count} ${count === 1 ? "evento" : "eventos"} el ${row.dia} a las ${hora}:00 ${ampm}`}
                                    onClick={() => {
                                      setFiltroDia(prev => (prev === row.dia ? null : row.dia));
                                      setFiltroHora(prev => (prev === j ? null : j));
                                    }}
                                    // Celda cuadrada, sin radio y sin transicion.
                                    className={`group relative aspect-square flex-1 cursor-crosshair bg-dg-info hover:ring-1 hover:ring-dg-text ${seleccionada ? 'z-10 ring-1 ring-dg-text' : ''}`}
                                    style={{ opacity: baseOpacity }}
                                  >
                                    <span aria-hidden="true" className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap border border-dg-border-hi bg-dg-card px-2 py-1.5 text-2xs text-dg-text opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                                      <span className="font-bold text-dg-info">{count} Eventos</span> <span className="opacity-50">el</span> {row.dia} <span className="opacity-50">a las</span> {hora}:00 {ampm}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Donut Chart: Vectores de Ataque */}
                <div className="mini-card flex flex-1 flex-col p-4 sm:p-5">
                  <h2 className="mini-h2 mb-5">Vectores de Ataque ({periodoLabel})</h2>
                  <div className="flex h-auto w-full flex-1 flex-col items-center justify-center gap-6 md:h-40 md:flex-row md:gap-0">
                    {motivosFraude.length === 0 ? (
                      <div className="flex h-40 w-full items-center justify-center text-xs uppercase tracking-[0.8px] text-dg-text-muted md:h-full">
                        Sin fraudes registrados
                      </div>
                    ) : (
                      <>
                        <div className="relative h-40 w-full shrink-0 md:h-full md:w-[45%]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={motivosFraude}
                                cx="50%"
                                cy="50%"
                                innerRadius={55}
                                outerRadius={75}
                                // Anillo continuo, sin separacion entre
                                // tramos ni animacion de entrada.
                                paddingAngle={0}
                                isAnimationActive={false}
                                dataKey="value"
                                stroke="none"
                                onClick={(entry) => {
                                  setFiltroMotivo(prev => {
                                    const next = prev === entry.name ? null : entry.name;
                                    return next;
                                  });
                                }}
                                className="cursor-pointer"
                              >
                                {motivosFraude.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} opacity={filtroMotivo && filtroMotivo !== entry.name ? 0.3 : 1} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={TOOLTIP_PLANO} />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                            <span className="tabular text-2xl font-bold leading-none text-dg-text">
                              {motivosFraude.reduce((acc, curr) => acc + curr.value, 0)}
                            </span>
                            <span className="mt-1 text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">
                              Total
                            </span>
                          </div>
                        </div>
                        <div className="flex w-full flex-col justify-center gap-2 md:w-[55%] md:pl-6 md:pr-6 lg:pl-8 lg:pr-12">
                          {motivosFraude.map((m, i) => {
                            const total = motivosFraude.reduce((acc, curr) => acc + curr.value, 0);
                            const porcentaje = total > 0 ? Math.round((m.value / total) * 100) : 0;
                            return (
                              <button
                                key={i}
                                type="button"
                                aria-pressed={filtroMotivo === m.name}
                                aria-label={`Filtrar por ${m.name}: ${m.value} eventos, ${porcentaje} por ciento`}
                                className={`-mx-2 flex w-full cursor-pointer flex-col gap-1.5 px-2 py-1 text-left hover:bg-white/5 ${filtroMotivo && filtroMotivo !== m.name ? 'opacity-30' : ''}`}
                                onClick={() => setFiltroMotivo(prev => (prev === m.name ? null : m.name))}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">{m.name}</span>
                                  <span className="tabular text-xs font-bold text-dg-text">
                                    {m.value} <span className="ml-1 text-2xs font-normal text-dg-text-muted">({porcentaje}%)</span>
                                  </span>
                                </div>
                                {/* Barra recta, como las de Skills del portafolio. */}
                                <div className="h-1 w-full bg-white/5">
                                  <div className="h-full" style={{ width: `${porcentaje}%`, backgroundColor: m.color }} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* Status and Latest */}
              <section className="order-1 flex flex-col space-y-4 lg:order-2">
                {/* Spacer para simetría con selector de período */}
                <div className="hidden h-[30px] lg:block" />
                <div className="mini-card">
                  <div className="border-b border-dg-border px-4 py-4 sm:px-5">
                    <h2 className="mini-h2">Estado del Sistema</h2>
                  </div>
                  <div className="divide-y divide-dg-border">
                    <div className="flex items-center justify-between px-4 py-3.5 sm:px-5">
                      <div className="flex items-center gap-3">
                        <Server aria-hidden="true" className="h-4 w-4 text-dg-text-muted" />
                        <span className="text-sm text-dg-text">Nodo Edge</span>
                      </div>
                      <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.8px] ${isEdgeOnline(estado?.ultimo_heartbeat ?? null) ? 'text-dg-success' : 'text-dg-error'}`}>
                        {/* Punto cuadrado y quieto: el original latia en bucle. */}
                        <span aria-hidden="true" className={`h-1.5 w-1.5 ${isEdgeOnline(estado?.ultimo_heartbeat ?? null) ? 'bg-dg-success' : 'bg-dg-error'}`} />
                        {isEdgeOnline(estado?.ultimo_heartbeat ?? null) ? "Online" : "Offline"}
                      </span>
                    </div>
                    {(() => {
                      const cam = (estado?.camaras ?? [])[0];
                      if (!cam) return null;
                      const activa = isCamaraActiva(cam, estado?.ultimo_heartbeat ?? null);
                      return (
                        <div className="flex items-center justify-between px-4 py-3.5 sm:px-5">
                          <div className="flex items-center gap-3">
                            <Video aria-hidden="true" className="h-4 w-4 text-dg-text-muted" />
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-dg-text">Cámara</span>
                              <span className="border border-dg-border px-1.5 py-0.5 text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">
                                {cam.camera_type}
                              </span>
                            </div>
                          </div>
                          <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-[0.8px] ${activa ? 'text-dg-success' : 'text-dg-error'}`}>
                            <span aria-hidden="true" className={`h-1.5 w-1.5 ${activa ? 'bg-dg-success' : 'bg-dg-error'}`} />
                            {activa ? "Activa" : "Inactiva"}
                          </span>
                        </div>
                      );
                    })()}
                    <div className="flex items-center justify-between px-4 py-3.5 sm:px-5">
                      <div className="flex items-center gap-3">
                        <History aria-hidden="true" className="h-4 w-4 text-dg-text-muted" />
                        <span className="text-sm text-dg-text">Último evento</span>
                      </div>
                      <span className="text-xs uppercase tracking-[0.8px] text-dg-text-muted">{ultimoEvento}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3.5 sm:px-5">
                      <div className="flex items-center gap-3">
                        <Users aria-hidden="true" className="h-4 w-4 text-dg-text-muted" />
                        <span className="text-sm text-dg-text">Usuarios registrados</span>
                      </div>
                      <span className="tabular text-xs font-bold text-dg-text">{stats.totalUsuarios}</span>
                    </div>
                  </div>
                </div>

                {/* Latest Events */}
                <div className="flex flex-1 flex-col space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="mini-h2">Últimos Eventos</h2>
                    <button
                      onClick={() => navigate("/history")}
                      className="border-b border-dg-text-muted pb-0.5 text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted hover:border-dg-text hover:text-dg-text"
                    >
                      Ver todo
                    </button>
                  </div>
                  {events.length === 0 ? (
                    <div className="mini-card p-8 text-center text-sm uppercase tracking-[0.8px] text-dg-text-muted">
                      No hay eventos registrados aún
                    </div>
                  ) : (
                    /*
                      Una sola tarjeta con filas separadas por filete, en vez
                      de seis tarjetas flotando con hueco entre ellas. Es la
                      lista plana del portafolio.
                    */
                    <div className="mini-card flex-1 divide-y divide-dg-border">
                      {events.map((evento, idx) => {
                        const config = getEventConfig(evento);
                        return (
                          <button
                            key={evento.id}
                            type="button"
                            onClick={() => navigate(`/event/${evento.id}`)}
                            className={`w-full items-start gap-4 p-4 text-left hover:bg-white/5 sm:p-5 ${idx >= 3 ? 'hidden lg:flex' : 'flex'}`}
                          >
                            <config.icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${config.color}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className={`text-sm font-bold uppercase tracking-[0.8px] ${config.color}`}>
                                  {config.title}
                                </p>
                                <div className="flex shrink-0 items-center gap-2">
                                  {evento.camera_id && (
                                    <span className={`border px-1.5 py-0.5 text-2xs font-bold uppercase tracking-[0.8px] ${evento.camera_type === "3D"
                                        ? "border-dg-action-text/40 text-dg-action-text"
                                        : "border-dg-info/40 text-dg-info"
                                      }`}>
                                      {evento.camera_id === "entrada_principal" ? "CAM-01" : "CAM-02"} · {evento.camera_type}
                                    </span>
                                  )}
                                  <span className="tabular text-2xs text-dg-text-muted">{formatTime(evento.timestamp)}</span>
                                </div>
                              </div>
                              <p className="mt-1.5 text-sm text-dg-text-secondary">{config.sub}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </>
        )}
      </main>

      {/* La cabecera tambien cambia: variante de texto, alineada a la
          derecha y con el destino activo invertido. */}
      <Navigation variante="minimal" />
    </div>
  );
}
