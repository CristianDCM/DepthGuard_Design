import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, SearchX, CheckCircle, AlertTriangle, HelpCircle, ChevronRight, History as HistoryIcon, Download, Calendar, X } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";
import { getHistorialPaginado, type Evento, type EstadoEvento } from "../lib/supabase";
import { exportToCSV } from "../lib/exportUtils";
import { usePantallaFija } from "../lib/usePantallaFija";

export default function History() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"Todos" | "Autorizados" | "Fraude" | "Desconocido">("Todos");
  const [events, setEvents] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  /** Hay una peticion en curso sobre datos que YA se estan mostrando. */
  const [recargando, setRecargando] = useState(false);
  // La lista rueda por dentro; la pagina no crece con cada "Cargar mas".
  usePantallaFija();
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const limit = 50;

  const hasFechaFilter = fechaDesde !== "" || fechaHasta !== "";
  /** Hay algo estrechando la lista: el vacio puede ser culpa del filtro. */
  const hayFiltros = hasFechaFilter || searchQuery !== "" || activeFilter !== "Todos";

  useEffect(() => {
    async function cargarInicial() {
      // Solo se vacia la pantalla en la PRIMERA carga. Al cambiar de filtro
      // se conserva lo que ya hay: antes la lista entera se sustituia por un
      // aro azul girando que aparecia y desaparecia en un parpadeo, y el
      // salto de la pagina a un hueco vacio y de vuelta se leia como un
      // fallo.
      setRecargando(true);
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
        setRecargando(false);
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
      default:
        return { title: "Estado no reconocido", sub: "Abra el detalle del evento", icon: HelpCircle, color: "text-dg-text-muted", highlight: false };
    }
  }

  /** Etiqueta del estado, sin mezclarla con el nombre de la persona. */
  function etiquetaEstado(evento: Evento) {
    switch (evento.estado) {
      case "ACCESO_PERMITIDO": return "Acceso autorizado";
      case "FRAUDE": return "Intento de fraude";
      case "DESCONOCIDO": return "Desconocido";
      default: return "Estado no reconocido";
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
    <div className="h-full pb-16 lg:pb-0 lg:pt-16 flex flex-col overflow-hidden">
      {/* Sin cabecera de titulo: la barra de navegacion ya dice donde
          estas. El <h1> se conserva para lectores de pantalla. */}
      <h1 className="sr-only">Historial de accesos</h1>

      <main
        id="contenido"
        /*
          Alto fijo, no crecedero.

          Antes cada "Cargar mas eventos" alargaba la pagina: con doscientos
          registros, la barra de desplazamiento del navegador se volvia
          inservible y los filtros quedaban a kilometros del final. Ahora la
          pantalla ocupa el alto libre y es LA LISTA la que se desplaza por
          dentro, con los filtros siempre a la vista.
        */
        className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 max-w-7xl mx-auto w-full overflow-hidden"
      >
        {/*
          Barra de herramientas. Los filtros y la exportacion vivian en la
          cabecera; al quitarla bajan aqui, justo encima de lo que filtran.
        */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-center">
              <div className="relative flex-1 md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dg-text-muted w-4 h-4" />
                <input 
                  type="search"
                  aria-label="Buscar accesos por nombre o motivo"
                  placeholder="Buscar accesos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-dg-card border-none rounded-dg py-2.5 pl-10 pr-4 text-base focus:ring-2 focus:ring-dg-focus/50 placeholder:text-dg-text-muted text-dg-text"
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
                    className={`w-full md:w-[145px] bg-dg-card border-none rounded-dg py-2.5 pl-10 pr-4 text-base focus:ring-2 focus:ring-dg-focus/50 appearance-none [color-scheme:dark] relative [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer ${fechaDesde ? 'text-dg-text' : 'text-dg-text-muted'}`}
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
                    className={`w-full md:w-[145px] bg-dg-card border-none rounded-dg py-2.5 pl-10 pr-4 text-base focus:ring-2 focus:ring-dg-focus/50 appearance-none [color-scheme:dark] relative [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer ${fechaHasta ? 'text-dg-text' : 'text-dg-text-muted'}`}
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
          {/*
            Filtros y exportacion: la exportacion vuelca justo lo que los
            filtros dejan a la vista, asi que van juntos. En pantalla
            estrecha el boton baja a su propia fila; compartiendo fila,
            recortaba el ultimo chip de la tira desplazable.
          */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-1">
              <FilterChip label="Todos" active={activeFilter === "Todos"} onClick={() => setActiveFilter("Todos")} />
              <FilterChip label="Autorizados" icon={CheckCircle} iconColor="text-dg-success" active={activeFilter === "Autorizados"} onClick={() => setActiveFilter("Autorizados")} />
              <FilterChip label="Fraude" icon={AlertTriangle} iconColor="text-dg-error" active={activeFilter === "Fraude"} onClick={() => setActiveFilter("Fraude")} />
              <FilterChip label="Desconocido" icon={HelpCircle} iconColor="text-dg-warning" active={activeFilter === "Desconocido"} onClick={() => setActiveFilter("Desconocido")} />
            </div>
            <button 
              onClick={handleExportCSV}
              disabled={events.length === 0}
              className="flex shrink-0 items-center gap-1.5 self-end px-3 py-1.5 rounded-full bg-dg-card border border-dg-border text-dg-text-muted hover:text-dg-text hover:border-dg-action-text transition-colors text-xs font-bold disabled:opacity-50 sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" /> CSV
            </button>
          </div>
        </div>

        {/*
          Indicador de recarga: una linea fina sobre la lista, que no mueve
          nada de sitio. El aro giratorio anterior vaciaba la pantalla y
          volvia a llenarla en un parpadeo cada vez que se tocaba un filtro.
        */}
        <div aria-hidden="true" className="h-0.5 shrink-0 overflow-hidden rounded-full bg-dg-border/40">
          {recargando && <div className="h-full w-1/3 animate-pulse rounded-full bg-dg-info" />}
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-dg-text-muted">Cargando historial…</p>
          </div>
        ) : events.length === 0 ? (
          /*
            Antes esto era una linea de texto suelta. Con filtros puestos, la
            pantalla vacia y ninguna salida, parece que el sistema no ha
            registrado nada, cuando lo que pasa es que el filtro no deja ver.
          */
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <SearchX className="h-10 w-10 text-dg-text-off" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-dg-text">Ningún evento coincide</p>
              <p className="mt-1 text-xs text-dg-text-muted">
                {hayFiltros
                  ? "Pruebe a ampliar el rango de fechas o a quitar algún filtro."
                  : "Todavía no se ha registrado ningún acceso."}
              </p>
            </div>
            {hayFiltros && (
              <button
                onClick={() => { setSearchQuery(""); setFechaDesde(""); setFechaHasta(""); setActiveFilter("Todos"); }}
                className="btn-secondary mt-1 px-5 py-2 text-sm"
              >
                Quitar filtros
              </button>
            )}
          </div>
        ) : (
          <div className={`flex min-h-0 flex-1 flex-col transition-opacity ${recargando ? "opacity-60" : ""}`}>
          {/*
            Tabla real a partir de 1024px.

            Un registro de auditoria se lee comparando columnas: a que hora,
            quien, con cuanta confianza y por que. La lista de tarjetas
            obliga a leer cada fila entera para extraer un dato, y en un
            monitor ancho desperdicia el espacio que hace util la comparacion.
            Debajo de 1024px las tarjetas siguen siendo lo correcto.
          */}
          <div className="hidden lg:block overflow-auto rounded-dg border border-dg-border custom-scrollbar lg:min-h-0 lg:flex-1">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Historial de accesos. {events.length} eventos cargados.
              </caption>
              <thead className="sticky top-0 z-10 bg-dg-card">
                <tr className="border-b border-dg-border text-left">
                  {["Hora", "Estado", "Persona", "Confianza", "Motivo"].map((c) => (
                    <th
                      key={c}
                      scope="col"
                      className={`px-4 py-3 text-2xs font-bold uppercase text-dg-text-muted ${c === "Confianza" ? "text-right" : ""}`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((evento) => {
                  const config = getEventConfig(evento);
                  return (
                    <tr
                      key={evento.id}
                      className="border-b border-dg-border/60 transition-colors last:border-0 hover:bg-dg-input has-[a:focus-visible]:bg-dg-input"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-dg-text-secondary tabular">
                        {formatDate(evento.timestamp)} · {formatTime(evento.timestamp)}
                      </td>
                      <td className="px-4 py-2.5">
                        {/* El enlace vive aqui: lleva el nombre accesible de
                            la fila entera y es el unico elemento enfocable. */}
                        <Link
                          to={`/event/${evento.id}`}
                          className={`inline-flex items-center gap-2 font-semibold ${config.color} hover:underline`}
                        >
                          <config.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          {etiquetaEstado(evento)}
                          <span className="sr-only">
                            , ver detalle del evento de las {formatTime(evento.timestamp)}
                          </span>
                        </Link>
                      </td>
                      <td className="max-w-[16rem] truncate px-4 py-2.5 text-dg-text">
                        {evento.nombre ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-dg-text-secondary tabular">
                        {evento.confianza != null ? `${Math.round(evento.confianza * 100)}%` : "—"}
                      </td>
                      <td className="max-w-[20rem] truncate px-4 py-2.5 text-dg-text-muted">
                        {evento.motivo ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden min-h-0 flex-1 overflow-y-auto custom-scrollbar pb-2">
          {(Object.entries(groupedEvents) as [string, Evento[]][]).map(([dateLabel, dateEvents]) => (
            <div key={dateLabel}>
              <div className="text-xs font-bold text-dg-text-muted uppercase mb-2 mt-4">{dateLabel}</div>
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
                        <span className="text-2xs font-medium text-dg-text-muted tabular">{formatTime(evento.timestamp)}</span>
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
          ))}
          </div>
          </div>
        )}

        {!loading && hasMore && events.length > 0 && (
          <div className="flex shrink-0 justify-center pt-1 pb-2">
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
