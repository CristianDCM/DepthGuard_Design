import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { SearchX, CheckCircle, AlertTriangle, HelpCircle, ChevronRight, Download, SlidersHorizontal } from "lucide-react";
import Navigation from "../components/Navigation";
import FiltroColumna from "../components/FiltroColumna";
import { getHistorialPaginado, type Evento, type EstadoEvento, type FiltrosHistorial } from "../lib/supabase";
import { exportToCSV } from "../lib/exportUtils";
import { usePantallaFija } from "../lib/usePantallaFija";

/** Los tres estados que escribe el terminal, con su rótulo y su color. */
const ESTADOS: { valor: EstadoEvento; etiqueta: string; icono: any; color: string }[] = [
  { valor: "ACCESO_PERMITIDO", etiqueta: "Acceso autorizado", icono: CheckCircle, color: "text-dg-success" },
  { valor: "FRAUDE", etiqueta: "Intento de fraude", icono: AlertTriangle, color: "text-dg-error" },
  { valor: "DESCONOCIDO", etiqueta: "Desconocido", icono: HelpCircle, color: "text-dg-warning" },
];

/**
 * Filtro de la pantalla, con un campo por columna de la tabla. Los números
 * viven como texto porque vienen de <input>: un campo a medio escribir no es
 * un número, y convertirlo en 0 mientras se teclea filtra por lo que nadie
 * ha pedido.
 */
interface Filtros {
  fechaDesde: string;
  fechaHasta: string;
  /** Hora del día, 0-23, como texto de <select>. */
  horaDesde: string;
  horaHasta: string;
  estados: EstadoEvento[];
  persona: string;
  motivo: string;
  /** Confianza en porcentaje. */
  confianzaMin: string;
  confianzaMax: string;
}

const SIN_FILTROS: Filtros = {
  fechaDesde: "",
  fechaHasta: "",
  horaDesde: "",
  horaHasta: "",
  estados: [],
  persona: "",
  motivo: "",
  confianzaMin: "",
  confianzaMax: "",
};

export default function History() {
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS);
  const [events, setEvents] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  /** Hay una peticion en curso sobre datos que YA se estan mostrando. */
  const [recargando, setRecargando] = useState(false);
  const [panelMovil, setPanelMovil] = useState(false);
  // La lista rueda por dentro; la pagina no crece con cada "Cargar mas".
  usePantallaFija();
  const limit = 50;

  const cambiar = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) =>
    setFiltros((prev) => ({ ...prev, [campo]: valor }));

  /**
   * Lo que viaja al servidor. La hora se queda fuera a proposito: ver el
   * comentario de getHistorialPaginado.
   */
  const filtrosServidor: FiltrosHistorial = useMemo(
    () => ({
      estados: filtros.estados.length > 0 ? filtros.estados : undefined,
      persona: filtros.persona.trim() || undefined,
      motivo: filtros.motivo.trim() || undefined,
      fechaDesde: filtros.fechaDesde || undefined,
      fechaHasta: filtros.fechaHasta || undefined,
      confianzaMin: filtros.confianzaMin === "" ? undefined : Number(filtros.confianzaMin),
      confianzaMax: filtros.confianzaMax === "" ? undefined : Number(filtros.confianzaMax),
    }),
    [filtros]
  );
  const claveServidor = JSON.stringify(filtrosServidor);

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
        const res = await getHistorialPaginado(0, limit, filtrosServidor);
        setEvents(res.data);
        setHasMore(res.data.length === limit);
      } catch (err) {
        console.error("Error cargando historial:", err);
      } finally {
        setLoading(false);
        setRecargando(false);
      }
    }
    // Debounce: los campos de texto disparan a cada tecla.
    const timer = setTimeout(cargarInicial, 300);
    return () => clearTimeout(timer);
  }, [claveServidor]);

  async function cargarMas() {
    const nextPg = page + 1;
    try {
      const res = await getHistorialPaginado(nextPg, limit, filtrosServidor);
      setEvents(prev => [...prev, ...res.data]);
      setPage(nextPg);
      setHasMore(res.data.length === limit);
    } catch (err) {
      console.error("Error cargando más eventos:", err);
    }
  }

  /**
   * Filtro de hora, el unico que se aplica aqui. Se hace sobre lo cargado y
   * la propia columna lo advierte.
   */
  const visibles = useMemo(() => {
    const desde = filtros.horaDesde === "" ? null : Number(filtros.horaDesde);
    const hasta = filtros.horaHasta === "" ? null : Number(filtros.horaHasta);
    if (desde === null && hasta === null) return events;
    return events.filter((ev) => {
      const h = new Date(ev.timestamp).getHours();
      return (desde === null || h >= desde) && (hasta === null || h <= hasta);
    });
  }, [events, filtros.horaDesde, filtros.horaHasta]);

  const activos = {
    fecha: filtros.fechaDesde !== "" || filtros.fechaHasta !== "",
    hora: filtros.horaDesde !== "" || filtros.horaHasta !== "",
    estado: filtros.estados.length > 0,
    persona: filtros.persona.trim() !== "",
    confianza: filtros.confianzaMin !== "" || filtros.confianzaMax !== "",
    motivo: filtros.motivo.trim() !== "",
  };
  const numActivos = Object.values(activos).filter(Boolean).length;

  function limpiarColumna(columna: keyof typeof activos) {
    const vacios: Record<keyof typeof activos, Partial<Filtros>> = {
      fecha: { fechaDesde: "", fechaHasta: "" },
      hora: { horaDesde: "", horaHasta: "" },
      estado: { estados: [] },
      persona: { persona: "" },
      confianza: { confianzaMin: "", confianzaMax: "" },
      motivo: { motivo: "" },
    };
    setFiltros((prev) => ({ ...prev, ...vacios[columna] }));
  }

  function handleExportCSV() {
    const filename = `historial_${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(visibles, filename);
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
    return ESTADOS.find((e) => e.valor === evento.estado)?.etiqueta ?? "Estado no reconocido";
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
  const groupedEvents = visibles.reduce<Record<string, Evento[]>>((acc, evento) => {
    const dateKey = formatDate(evento.timestamp);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(evento);
    return acc;
  }, {});

  const controles = {
    fecha: <ControlesFecha filtros={filtros} cambiar={cambiar} />,
    hora: <ControlesHora filtros={filtros} cambiar={cambiar} />,
    estado: <ControlesEstado filtros={filtros} cambiar={cambiar} />,
    persona: (
      <ControlTexto
        etiqueta="Nombre contiene"
        valor={filtros.persona}
        onChange={(v) => cambiar("persona", v)}
        marcador="Ej: Laura"
      />
    ),
    confianza: <ControlesConfianza filtros={filtros} cambiar={cambiar} />,
    motivo: (
      <ControlTexto
        etiqueta="Motivo contiene"
        valor={filtros.motivo}
        onChange={(v) => cambiar("motivo", v)}
        marcador="Ej: foto impresa"
      />
    ),
  };

  return (
    <div className="h-full pb-barra lg:pb-0 lg:pt-16 flex flex-col overflow-hidden">
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
          dentro, con las cabeceras siempre a la vista.
        */
        className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 max-w-7xl mx-auto w-full overflow-hidden"
      >
        {/*
          Barra de estado del filtro. Los filtros en si viven en la cabecera
          de cada columna, como en una hoja de calculo; aqui solo queda lo
          que no es de una columna concreta: cuantos hay puestos, como
          quitarlos de golpe y la exportacion, que vuelca justo lo que la
          tabla deja a la vista.
        */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={() => setPanelMovil((v) => !v)}
            aria-expanded={panelMovil}
            className={`btn flex items-center gap-1.5 px-3 py-1.5 text-2xs lg:hidden ${numActivos > 0 ? "btn-on" : ""}`}
          >
            <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
            Filtros{numActivos > 0 ? ` (${numActivos})` : ""}
          </button>

          <span className="hidden text-2xs uppercase tracking-[0.8px] text-dg-text-muted lg:inline">
            {numActivos === 0
              ? "Sin filtros · use el embudo de cada columna"
              : `${numActivos} ${numActivos === 1 ? "columna filtrada" : "columnas filtradas"}`}
          </span>

          {numActivos > 0 && (
            <button onClick={() => setFiltros(SIN_FILTROS)} className="btn px-2.5 py-1 text-2xs">
              Limpiar todo
            </button>
          )}

          <button
            onClick={handleExportCSV}
            disabled={visibles.length === 0}
            className="btn ml-auto flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-2xs disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" /> CSV
          </button>
        </div>

        {/* Panel de filtros en movil: los mismos controles, apilados, porque
            ahi no hay cabecera de tabla donde colgarlos. */}
        {panelMovil && (
          <div className="card max-h-[45vh] shrink-0 space-y-4 overflow-y-auto p-4 custom-scrollbar lg:hidden">
            {(Object.keys(controles) as (keyof typeof controles)[]).map((columna) => (
              <div key={columna} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-2xs font-bold uppercase tracking-[0.8px] text-dg-text">
                    {ROTULOS[columna]}
                  </span>
                  {activos[columna] && (
                    <button
                      onClick={() => limpiarColumna(columna)}
                      className="text-2xs uppercase tracking-[0.8px] text-dg-action-text"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                {controles[columna]}
              </div>
            ))}
          </div>
        )}

        {/*
          Indicador de recarga: una linea fina sobre la lista, que no mueve
          nada de sitio. El aro giratorio anterior vaciaba la pantalla y
          volvia a llenarla en un parpadeo cada vez que se tocaba un filtro.
        */}
        <div aria-hidden="true" className="h-0.5 shrink-0 overflow-hidden bg-dg-border/40">
          {recargando && <div className="h-full w-full bg-dg-info" />}
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-dg-text-muted">Cargando historial…</p>
          </div>
        ) : visibles.length === 0 ? (
          /*
            Antes esto era una linea de texto suelta. Con filtros puestos, la
            pantalla vacia y ninguna salida, parece que el sistema no ha
            registrado nada, cuando lo que pasa es que el filtro no deja ver.
          */
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <SearchX className="h-10 w-10 text-dg-text-off" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.8px] text-dg-text">Ningún evento coincide</p>
              <p className="mt-1 text-xs text-dg-text-muted">
                {numActivos > 0
                  ? "Pruebe a ampliar el rango de fechas o a quitar algún filtro de columna."
                  : "Todavía no se ha registrado ningún acceso."}
              </p>
            </div>
            {numActivos > 0 && (
              <button onClick={() => setFiltros(SIN_FILTROS)} className="btn mt-1 px-5 py-2.5 text-sm">
                Quitar filtros
              </button>
            )}
          </div>
        ) : (
          <div className={`flex min-h-0 flex-1 flex-col ${recargando ? "opacity-60" : ""}`}>
          {/*
            Tabla real a partir de 1024px.

            Un registro de auditoria se lee comparando columnas: a que hora,
            quien, con cuanta confianza y por que. La lista de tarjetas
            obliga a leer cada fila entera para extraer un dato, y en un
            monitor ancho desperdicia el espacio que hace util la comparacion.
            Debajo de 1024px las tarjetas siguen siendo lo correcto.
          */}
          <div className="hidden lg:block overflow-auto border border-dg-border custom-scrollbar lg:min-h-0 lg:flex-1">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Historial de accesos. {visibles.length} eventos cargados.
              </caption>
              {/* La cabecera fija necesita fondo opaco para tapar las filas
                  que pasan por debajo; el del lienzo ya lo es. */}
              <thead className="sticky top-0 z-10 bg-dg-bg">
                <tr className="border-b border-dg-border text-left">
                  <th scope="col" className="px-4 py-3.5">
                    <FiltroColumna etiqueta="Fecha" activo={activos.fecha} onLimpiar={() => limpiarColumna("fecha")}>
                      {controles.fecha}
                    </FiltroColumna>
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    <FiltroColumna etiqueta="Hora" activo={activos.hora} onLimpiar={() => limpiarColumna("hora")}>
                      {controles.hora}
                    </FiltroColumna>
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    <FiltroColumna etiqueta="Estado" activo={activos.estado} onLimpiar={() => limpiarColumna("estado")}>
                      {controles.estado}
                    </FiltroColumna>
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    <FiltroColumna etiqueta="Persona" activo={activos.persona} onLimpiar={() => limpiarColumna("persona")}>
                      {controles.persona}
                    </FiltroColumna>
                  </th>
                  <th scope="col" className="px-4 py-3.5 text-right">
                    <FiltroColumna
                      etiqueta="Confianza"
                      activo={activos.confianza}
                      onLimpiar={() => limpiarColumna("confianza")}
                      alineacion="derecha"
                    >
                      {controles.confianza}
                    </FiltroColumna>
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    <FiltroColumna
                      etiqueta="Motivo"
                      activo={activos.motivo}
                      onLimpiar={() => limpiarColumna("motivo")}
                      alineacion="derecha"
                    >
                      {controles.motivo}
                    </FiltroColumna>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((evento) => {
                  const config = getEventConfig(evento);
                  return (
                    <tr
                      key={evento.id}
                      className="border-b border-dg-border last:border-0 hover:bg-white/5 has-[a:focus-visible]:bg-white/5"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-dg-text-secondary">
                        {formatDate(evento.timestamp)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-dg-text-secondary tabular">
                        {formatTime(evento.timestamp)}
                      </td>
                      <td className="px-4 py-2.5">
                        {/* El enlace vive aqui: lleva el nombre accesible de
                            la fila entera y es el unico elemento enfocable. */}
                        <Link
                          to={`/event/${evento.id}`}
                          className={`inline-flex items-center gap-2 font-bold uppercase tracking-[0.8px] ${config.color} hover:underline`}
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
              <div className="mb-2 mt-4 text-xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">{dateLabel}</div>
              {dateEvents.map((evento) => {
                const config = getEventConfig(evento);
                return (
                  <div
                    key={evento.id}
                    className={`card card-linked relative mb-3 flex items-center gap-4 p-4 hover:bg-white/5 ${config.highlight ? 'border-dg-warning/50' : ''}`}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-dg-border">
                      <config.icon className={`h-7 w-7 ${config.color}`} aria-hidden="true" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-dg-text truncate">{config.title}</h3>
                        <span className="text-2xs font-medium text-dg-text-muted tabular">{formatTime(evento.timestamp)}</span>
                      </div>
                      <p className="text-xs text-dg-text-muted truncate">{config.sub}</p>
                      <Link
                        to={`/event/${evento.id}`}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.8px] text-dg-action-text focus-visible:outline-none after:absolute after:inset-0"
                      >
                        Ver detalles
                        <ChevronRight className="w-3 h-3" aria-hidden="true" />
                        <span className="sr-only">de {config.title} a las {formatTime(evento.timestamp)}</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          </div>
          </div>
        )}

        <div className="flex shrink-0 items-center justify-center gap-4 pt-1 pb-2">
          <span className="text-2xs uppercase tracking-[0.8px] text-dg-text-muted">
            {visibles.length} {visibles.length === 1 ? "evento" : "eventos"}
            {activos.hora && " · hora aplicada sobre lo cargado"}
          </span>
          {!loading && hasMore && events.length > 0 && (
            <button onClick={cargarMas} className="btn px-6 py-2 text-2xs">
              Cargar más
            </button>
          )}
        </div>
      </main>

      <Navigation />
    </div>
  );
}

// ============================================
// Controles de cada columna
// ============================================

const ROTULOS: Record<string, string> = {
  fecha: "Fecha",
  hora: "Hora",
  estado: "Estado",
  persona: "Persona",
  confianza: "Confianza",
  motivo: "Motivo",
};

type Cambiar = <K extends keyof Filtros>(campo: K, valor: Filtros[K]) => void;

function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">
      {children}
    </span>
  );
}

function ControlesFecha({ filtros, cambiar }: { filtros: Filtros; cambiar: Cambiar }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="space-y-1">
        <Rotulo>Desde</Rotulo>
        <input
          type="date"
          value={filtros.fechaDesde}
          onChange={(e) => cambiar("fechaDesde", e.target.value)}
          className="input-plano w-full py-1.5 text-xs"
        />
      </label>
      <label className="space-y-1">
        <Rotulo>Hasta</Rotulo>
        <input
          type="date"
          value={filtros.fechaHasta}
          onChange={(e) => cambiar("fechaHasta", e.target.value)}
          className="input-plano w-full py-1.5 text-xs"
        />
      </label>
    </div>
  );
}

function ControlesHora({ filtros, cambiar }: { filtros: Filtros; cambiar: Cambiar }) {
  const horas = Array.from({ length: 24 }, (_, i) => i);
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <Rotulo>Desde</Rotulo>
          <select
            value={filtros.horaDesde}
            onChange={(e) => cambiar("horaDesde", e.target.value)}
            className="input-plano w-full py-1.5 text-xs"
          >
            <option value="">Cualquiera</option>
            {horas.map((h) => (
              <option key={h} value={h}>{`${String(h).padStart(2, "0")}:00`}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <Rotulo>Hasta</Rotulo>
          <select
            value={filtros.horaHasta}
            onChange={(e) => cambiar("horaHasta", e.target.value)}
            className="input-plano w-full py-1.5 text-xs"
          >
            <option value="">Cualquiera</option>
            {horas.map((h) => (
              <option key={h} value={h}>{`${String(h).padStart(2, "0")}:59`}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-2xs leading-relaxed text-dg-text-muted">
        La hora se filtra sobre los eventos ya cargados, no en la base de datos.
      </p>
    </>
  );
}

function ControlesEstado({ filtros, cambiar }: { filtros: Filtros; cambiar: Cambiar }) {
  const alternar = (valor: EstadoEvento) =>
    cambiar(
      "estados",
      filtros.estados.includes(valor)
        ? filtros.estados.filter((e) => e !== valor)
        : [...filtros.estados, valor]
    );
  return (
    <div className="space-y-1.5">
      {ESTADOS.map((estado) => {
        const marcado = filtros.estados.includes(estado.valor);
        return (
          <label key={estado.valor} className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={marcado}
              onChange={() => alternar(estado.valor)}
              className="sr-only peer"
            />
            {/* El <input> va oculto y la casilla que se ve es un <span>, asi
                que el anillo de foco lo hereda con `peer`: sobre el input
                recortado a 1px no se veria. */}
            <span
              aria-hidden="true"
              className={`flex h-4 w-4 shrink-0 items-center justify-center border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-dg-focus ${
                marcado ? "border-dg-text bg-dg-text" : "border-dg-border"
              }`}
            >
              {marcado && <span className="h-1.5 w-1.5 bg-dg-bg" />}
            </span>
            <estado.icono aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 ${estado.color}`} />
            <span className="text-xs text-dg-text">{estado.etiqueta}</span>
          </label>
        );
      })}
    </div>
  );
}

function ControlTexto({
  etiqueta,
  valor,
  onChange,
  marcador,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  marcador: string;
}) {
  return (
    <label className="space-y-1">
      <Rotulo>{etiqueta}</Rotulo>
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={marcador}
        className="input-plano w-full py-1.5 text-xs"
      />
    </label>
  );
}

function ControlesConfianza({ filtros, cambiar }: { filtros: Filtros; cambiar: Cambiar }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <Rotulo>Mínimo %</Rotulo>
          <input
            type="number"
            min={0}
            max={100}
            value={filtros.confianzaMin}
            onChange={(e) => cambiar("confianzaMin", e.target.value)}
            placeholder="0"
            className="input-plano tabular w-full py-1.5 text-xs"
          />
        </label>
        <label className="space-y-1">
          <Rotulo>Máximo %</Rotulo>
          <input
            type="number"
            min={0}
            max={100}
            value={filtros.confianzaMax}
            onChange={(e) => cambiar("confianzaMax", e.target.value)}
            placeholder="100"
            className="input-plano tabular w-full py-1.5 text-xs"
          />
        </label>
      </div>
      <p className="text-2xs leading-relaxed text-dg-text-muted">
        Fraudes y desconocidos no traen confianza: con este filtro puesto no aparecen.
      </p>
    </>
  );
}
