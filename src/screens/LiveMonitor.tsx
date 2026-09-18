import React, { useEffect, useState } from "react";
import {
  Video,
  Activity,
  Cloud,
  User,
  Shield,
  ShieldAlert,
  ShieldQuestion,
  Server,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Eye,
  VideoOff,
  Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Navigation from "../components/Navigation";
import WebRTCPlayer from "../components/WebRTCPlayer";
import IndicadorFrescura, { useFrescura, ContenidoFrescura } from "../components/IndicadorFrescura";
import { sonarAlerta } from "../lib/alertaSonora";
import {
  supabase,
  getEventosPorCamara,
  getEstadoSistema,
  isEdgeOnline,
  isCamaraActiva,
  type Evento,
  type EstadoSistema,
  type CameraId,
  type CameraType,
  type CamaraEstado,
} from "../lib/supabase";

/** Cada cuanto se pregunta por el estado del terminal. */
const SONDEO_HEARTBEAT_MS = 30_000;

// ============================================
// Tipos locales
// ============================================

interface CameraPanelData {
  cameraId: CameraId;
  cameraType: CameraType;
  label: string;
  ultimoEvento: Evento | null;
  lastFocusTime: number;
  eventosRecientes: Evento[];
}

// ============================================
// Componente principal
// ============================================

export default function LiveMonitor() {
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [panel, setPanel] = useState<CameraPanelData>({
    cameraId: "entrada_principal",
    cameraType: "3D",
    label: "Cámara",
    ultimoEvento: null,
    lastFocusTime: 0,
    eventosRecientes: [],
  });
  const [loading, setLoading] = useState(true);
  /**
   * Marca del ultimo sondeo CORRECTO del heartbeat. No la del ultimo
   * intento: lo que importa no es cuando preguntamos, sino cuando supimos
   * algo cierto por ultima vez.
   */
  const [ultimoExito, setUltimoExito] = useState<number | null>(null);

  // Cargar datos iniciales — detecta la primera cámara del heartbeat
  useEffect(() => {
    async function cargarDatos() {
      try {
        const estadoData = await getEstadoSistema();

        if (estadoData) {
          setEstado(estadoData);
          setUltimoExito(Date.now());

          // Detectar la cámara conectada (la que esté activa)
          const cam = estadoData.camaras.find(c => c.activa) || estadoData.camaras[0];
          if (cam) {
            const eventos = await getEventosPorCamara(cam.camera_id, 5);
            setPanel({
              cameraId: cam.camera_id,
              cameraType: cam.camera_type,
              label: "Cámara",
              ultimoEvento: eventos[0] ?? null,
              lastFocusTime: 0,
              eventosRecientes: eventos,
            });
          }
        }
      } catch (err) {
        console.error("Error cargando monitor:", err);
      } finally {
        setLoading(false);
      }
    }
    cargarDatos();
  }, []);

  // Suscripción Realtime — escucha INSERTs en historial
  useEffect(() => {
    const channel = supabase
      .channel("live-monitor-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "historial" },
        (payload) => {
          const nuevoEvento = payload.new as Evento;

          // Sin banda superpuesta: el aviso sonoro (opcional, se activa en
          // Ajustes) y el resalte de la tarjeta bastan.
          if (nuevoEvento.estado === "FRAUDE") sonarAlerta();

          setPanel((prev) => {
            // Solo procesar eventos de la cámara que estamos mostrando
            if (nuevoEvento.camera_id !== prev.cameraId) return prev;

            const isFraude = nuevoEvento.estado === "FRAUDE";
            const timeSinceLastFocus = Date.now() - prev.lastFocusTime;

            /*
             * La tarjeta de veredicto no cambia si han pasado menos de 5 s
             * desde el ultimo cambio, para que no parpadee con una cola de
             * gente. El evento NO se pierde: sigue entrando entero en el log
             * de la derecha, que es de donde sale el recuento de abajo.
             */
            const updateFocus = isFraude || timeSinceLastFocus > 5000;
            const newUltimoEvento = updateFocus ? nuevoEvento : prev.ultimoEvento;
            const newLastFocusTime = updateFocus ? Date.now() : prev.lastFocusTime;

            return {
              ...prev,
              ultimoEvento: newUltimoEvento,
              lastFocusTime: newLastFocusTime,
              eventosRecientes: [nuevoEvento, ...prev.eventosRecientes].slice(0, 50),
            };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Sondeo del heartbeat cada 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const estadoData = await getEstadoSistema();
        if (estadoData) {
          setEstado(estadoData);
          setUltimoExito(Date.now());
          // Actualizar tipo de cámara si cambió, priorizando la activa
          const cam = estadoData.camaras.find(c => c.activa) || estadoData.camaras[0];
          if (cam) {
            setPanel(prev => ({
              ...prev,
              cameraId: cam.camera_id,
              cameraType: cam.camera_type,
            }));
          }
        }
      } catch {
        /*
         * A proposito no se toca `ultimoExito`: el indicador de frescura
         * envejece solo y acaba avisando. Antes este catch vacio dejaba la
         * pildora en verde diciendo "EN LINEA" sobre datos muertos.
         */
      }
    }, SONDEO_HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, []);

  const frescura = useFrescura(ultimoExito, SONDEO_HEARTBEAT_MS);
  /*
   * Con el dato obsoleto NO afirmamos que el terminal este en linea: lo
   * unico que sabemos es que hace rato que no lo sabemos. Antes la pildora
   * seguia en verde indefinidamente aunque el backend estuviera caido.
   */
  const edgeOnline = frescura.atenuar ? false : isEdgeOnline(estado?.ultimo_heartbeat ?? null);
  const cam = (estado?.camaras ?? []).find(c => c.activa) || (estado?.camaras ?? [])[0];
  const camaraActiva = cam
    ? isCamaraActiva(cam, estado?.ultimo_heartbeat ?? null)
    : false;

  return (
    <div className="min-h-screen pb-24 lg:pb-0 lg:pl-60 flex flex-col bg-dg-bg">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Video className="w-6 h-6 text-dg-text-secondary" aria-hidden="true" />
            <h1 className="text-xl font-bold tracking-tight headline">
              Monitor en Vivo
            </h1>
          </div>
          {/* Edge Status Pill */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full border ${
              edgeOnline
                ? "bg-dg-success/10 border-dg-success/20"
                : "bg-dg-error/10 border-dg-error/20"
            }`}
          >
            <Server className={`w-3 h-3 ${edgeOnline ? "text-dg-success" : "text-dg-error"}`} aria-hidden="true" />
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                edgeOnline
                  ? "bg-dg-success shadow-[0_0_6px_var(--color-dg-success)] animate-pulse"
                  : "bg-dg-error"
              }`}
            />
            <span
              className={`text-2xs font-bold uppercase ${
                edgeOnline ? "text-dg-success" : "text-dg-error"
              }`}
            >
              {frescura.atenuar ? "Sin datos" : edgeOnline ? "En línea" : "Desconectado"}
            </span>
          </div>
        </div>
        {/*
          Frescura del dato. Solo se pinta cuando el dato deja de estar
          fresco: con todo al dia repetia en "En directo" lo que la pildora
          de al lado ya dice con "En linea".
        */}
        {frescura.nivel !== "fresco" && (
          <div className="mx-auto flex w-full max-w-7xl items-center justify-end px-4 pb-2">
            <IndicadorFrescura estado={frescura} />
          </div>
        )}
      </header>

      <main id="contenido" className="flex-1 px-4 py-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-dg-info border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ContenidoFrescura estado={frescura}>
          <CameraPanel
            data={panel}
            camaraActiva={camaraActiva}
            edgeOnline={edgeOnline}
            previewUrl={cam?.preview_url}
            layout="expanded"
            onEventFocus={(evento) => {
              setPanel((prev) => ({ 
                ...prev, 
                ultimoEvento: evento,
                lastFocusTime: Date.now()
              }));
            }}
          />
          </ContenidoFrescura>
        )}
      </main>

      <Navigation />
    </div>
  );
}

// ============================================
// Panel de cámara individual
// ============================================

function CameraPanel({
  data,
  camaraActiva,
  edgeOnline,
  previewUrl,
  layout = "compact",
  onEventFocus,
}: {
  key?: React.Key;
  data: CameraPanelData;
  camaraActiva: boolean;
  edgeOnline: boolean;
  /** URL firmada del preview, publicada por el edge en estado_sistema */
  previewUrl?: string;
  layout?: "compact" | "expanded";
  onEventFocus?: (evento: Evento) => void;
}) {
  const { cameraId, cameraType, label, ultimoEvento, eventosRecientes } = data;
  const statusConfig = getStatusConfig(ultimoEvento);

  // Cada panel gestiona su propio estado de fallback independientemente
  const [webrtcFailed, setWebrtcFailed] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: cameraId === "entrada_principal" ? 0 : 0.15,
      }}
      className="space-y-4"
    >
      {/* Camera Header - Siempre arriba ocupando todo el ancho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-dg flex items-center justify-center ${
              cameraType === "3D"
                ? "bg-dg-info/10 border border-dg-info/20"
                : "bg-dg-info/10 border border-dg-info/20"
            }`}
          >
            {cameraType === "3D" ? (
              <Shield className="w-5 h-5 text-dg-info" aria-hidden="true" />
            ) : (
              <Eye className="w-5 h-5 text-dg-info" />
            )}
          </div>
          <div>
            <h2 className="headline text-base font-bold tracking-tight">
              {label}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-2xs font-bold uppercase px-1.5 py-0.5 rounded-dg-sm ${
                  cameraType === "3D"
                    ? "bg-dg-info/10 text-dg-info"
                    : "bg-dg-info/10 text-dg-info"
                }`}
              >
                {cameraType === "3D" ? "Anti-spoofing 3D" : "Verificación 2D"}
              </span>
              <span
                className={`flex items-center gap-1 text-2xs font-bold uppercase ${
                  camaraActiva ? "text-dg-success" : "text-dg-error"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    camaraActiva
                      ? "bg-dg-success animate-pulse"
                      : "bg-dg-error"
                  }`}
                />
                {camaraActiva ? "Activa" : "Inactiva"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid del contenido principal */}
      <div className={layout === "expanded" ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" : "space-y-4"}>
        {/* Columna Izquierda (o única si es compact) */}
        <div className={layout === "expanded" ? "lg:col-span-8 space-y-4" : "space-y-4"}>

      {/* Preview en vivo. El veredicto vive en UNA sola tarjeta, debajo. */}
      {camaraActiva && !webrtcFailed ? (
        <WebRTCPlayer
          cameraId={cameraId}
          edgeOnline={edgeOnline}
          onFallback={() => setWebrtcFailed(true)}
        />
      ) : (
        <LiveSnapshotPreview
          camaraActiva={camaraActiva}
          cameraId={cameraId}
          previewUrl={previewUrl}
        />
      )}

      {/*
        Tarjeta de estado: el veredicto actual.

        Una sola fila de cabecera con el estado y la confianza a la derecha,
        y debajo los detalles solo cuando existen. Antes el titulo iba a 28px
        con la etiqueta encima, el sujeto en una caja propia y la hora en su
        propio renglon separado: cuatro bloques apilados para tres datos.
      */}
      <div className={`cyber-card ${statusConfig.borderClass}`}>
        <div className="flex items-center gap-3 p-4">
          <statusConfig.icon
            className="h-6 w-6 shrink-0"
            style={{ color: statusConfig.accentColor }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-bold uppercase text-dg-text-muted">
              Estatus de seguridad
            </p>
            <h3
              className="headline truncate text-lg font-bold"
              style={{ color: statusConfig.accentColor }}
            >
              {statusConfig.title}
            </h3>
          </div>
          {ultimoEvento?.confianza != null && (
            <div className="shrink-0 text-right">
              <p className="text-2xs font-bold uppercase text-dg-text-muted">Confianza</p>
              <p
                className="headline text-xl font-bold tabular"
                style={{ color: statusConfig.accentColor }}
              >
                {Math.round(ultimoEvento.confianza * 100)}%
              </p>
            </div>
          )}
        </div>

        {ultimoEvento && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-dg-border/60 px-4 py-2.5 text-xs">
            {ultimoEvento.nombre && (
              <span className="flex items-center gap-1.5 text-dg-text">
                <User className="h-3.5 w-3.5 text-dg-text-muted" aria-hidden="true" />
                {ultimoEvento.nombre}
              </span>
            )}
            {ultimoEvento.motivo && (
              <span className="min-w-0 truncate text-dg-error">{ultimoEvento.motivo}</span>
            )}
            <span className="ml-auto shrink-0 text-dg-text-muted tabular">
              {new Date(ultimoEvento.timestamp).toLocaleString("es", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
        )}
      </div>
      </div>

      {/* Columna Derecha (o apilada si es compact) */}
      <div className={layout === "expanded" ? "lg:col-span-4 space-y-4" : "space-y-4"}>
      {/* Anti-spoofing Metrics (solo si hay evento con métricas) */}
      {ultimoEvento?.metricas_json && (
        <div className="cyber-card p-4">
          <h4 className="text-2xs font-bold text-dg-text-muted uppercase mb-4">
            {cameraType === "3D"
              ? "Métricas Anti-Spoofing"
              : "Métricas de Detección"}
          </h4>
          <div className="space-y-3.5">
            {cameraType === "3D" && (
              <>
                <MetricBar
                  label="Varianza de Profundidad"
                  value={(ultimoEvento.metricas_json.varianza ?? 0).toFixed(1)}
                  progress={Math.min(
                    ((ultimoEvento.metricas_json.varianza ?? 0) / 5) * 100,
                    100
                  )}
                />
                <MetricBar
                  label="Rango 3D"
                  value={`${(ultimoEvento.metricas_json.rango_3d ?? 0).toFixed(1)} cm`}
                  progress={Math.min(
                    ((ultimoEvento.metricas_json.rango_3d ?? 0) / 15) * 100,
                    100
                  )}
                />
              </>
            )}
            <MetricBar
              label="Distancia Física"
              value={`${(ultimoEvento.metricas_json.distancia ?? 0).toFixed(0)} cm`}
              progress={Math.min(
                ((ultimoEvento.metricas_json.distancia ?? 0) / 150) * 100,
                100
              )}
              color="bg-dg-info"
            />
            {cameraType === "3D" && (
              <MetricBar
                label="Píxeles Válidos"
                value={`${Math.round((ultimoEvento.metricas_json.pixeles_validos ?? 0) * 100)}%`}
                progress={(ultimoEvento.metricas_json.pixeles_validos ?? 0) * 100}
                color="bg-dg-info"
              />
            )}
          </div>
        </div>
      )}

      {/* Mini Event Log */}
      <div className="cyber-card overflow-hidden">
        <div className="px-4 py-3 border-b border-dg-border bg-white/5 flex items-center justify-between">
          <h4 className="text-2xs font-bold text-dg-text-muted uppercase">
            Últimos Eventos
          </h4>
          <span className="text-2xs text-dg-text-muted font-medium tabular">
            {eventosRecientes.length} registros
          </span>
        </div>
        <div className="divide-y divide-dg-border max-h-[450px] overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="popLayout">
            {eventosRecientes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 p-8 text-center">
                <Activity className="h-6 w-6 text-dg-text-off" aria-hidden="true" />
                <p className="text-xs text-dg-text-muted">
                  Sin actividad todavía.<br />Los accesos aparecerán aquí en cuanto ocurran.
                </p>
              </div>
            ) : (
              eventosRecientes.map((evento) => (
                <MiniEventRow 
                  key={evento.id} 
                  evento={evento} 
                  onClick={() => onEventFocus && onEventFocus(evento)}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Connection footer */}
      <div className="flex items-center justify-between cyber-card p-4">
        <div className="flex items-center gap-2">
          <div className="relative w-6 h-6 flex items-center justify-center bg-dg-success/10 rounded-dg-sm">
            <Cloud className="w-3.5 h-3.5 text-dg-success" aria-hidden="true" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-dg-success rounded-full border border-dg-card animate-pulse" />
          </div>
          <div>
            <div className="text-2xs font-bold text-dg-text-muted uppercase">
              Supabase Realtime
            </div>
            <div className="text-2xs font-bold text-dg-success flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-dg-success" aria-hidden="true" />
              Suscrito
            </div>
          </div>
        </div>
        <div className="text-2xs px-2 py-1 rounded-dg-sm bg-white/5 font-mono text-dg-text-muted">
          {cameraId === "entrada_principal" ? "CAM-01" : "CAM-02"} ·{" "}
          {cameraType}
        </div>
      </div>
      </div>
      </div>
    </motion.div>
  );
}

// ============================================
// Sub-componentes
// ============================================

function MiniEventRow({ evento, onClick }: { key?: React.Key; evento: Evento; onClick?: () => void }) {
  const config = getEventMiniConfig(evento);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 min-h-[56px] transition-colors ${onClick ? 'cursor-pointer hover:bg-white/5' : ''}`}
    >
      <div
        className="w-7 h-7 rounded-dg-sm flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${config.color}15` }}
      >
        <config.icon
          className="w-4 h-4"
          style={{ color: config.color }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: config.color }}>
          {config.label}
        </p>
        <p className="text-2xs text-dg-text-muted truncate">
          {evento.nombre ?? evento.motivo ?? "Persona no registrada"}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className="text-2xs text-dg-text-muted font-medium tabular">
          {formatTime(evento.timestamp)}
        </span>
        {evento.confianza != null && (
          <p className="text-2xs font-bold text-dg-text-muted/60 tabular">
            {Math.round(evento.confianza * 100)}%
          </p>
        )}
      </div>
    </motion.div>
  );
}

function MetricBar({
  label,
  value,
  progress,
  color = "bg-dg-info",
}: {
  label: string;
  value: string | number;
  progress: number;
  color?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end">
        <span className="text-xs font-medium text-dg-text-secondary">{label}</span>
        <span className="text-2xs font-mono tabular text-dg-text-muted">
          {value}
        </span>
      </div>
      <div className="h-1.5 w-full bg-dg-canvas rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
    </div>
  );
}

// ============================================
// Helpers
// ============================================

function getStatusConfig(evento: Evento | null) {
  if (!evento) {
    return {
      title: "Esperando...",
      icon: Activity,
      accentColor: "var(--color-dg-text-muted)",
      borderClass: "",
    };
  }

  switch (evento.estado) {
    case "ACCESO_PERMITIDO":
      return {
        title: "Acceso Permitido",
        icon: CheckCircle,
        accentColor: "var(--color-dg-success)",
        borderClass: "",
      };
    case "FRAUDE":
      return {
        title: "¡Fraude Detectado!",
        icon: ShieldAlert,
        accentColor: "var(--color-dg-error)",
        borderClass: "border-dg-error/40",
      };
    case "DESCONOCIDO":
      return {
        title: "Desconocido",
        icon: ShieldQuestion,
        accentColor: "var(--color-dg-warning)",
        borderClass: "border-dg-warning/30",
      };
    default:
      // El estado lo escribe el edge, no la app. Sin este caso, un valor
      // nuevo o corrupto en la base devolvia undefined y la siguiente
      // lectura (statusConfig.borderClass) tumbaba el monitor entero.
      return {
        title: "Estado no reconocido",
        icon: HelpCircle,
        accentColor: "var(--color-dg-text-muted)",
        borderClass: "",
      };
  }
}

function getEventMiniConfig(evento: Evento) {
  switch (evento.estado) {
    case "ACCESO_PERMITIDO":
      return { label: "Acceso Autorizado", icon: CheckCircle, color: "var(--color-dg-success)" };
    case "FRAUDE":
      return { label: "Intento de Fraude", icon: AlertTriangle, color: "var(--color-dg-error)" };
    case "DESCONOCIDO":
      return { label: "Desconocido", icon: HelpCircle, color: "var(--color-dg-warning)" };
    default:
      return { label: "Estado no reconocido", icon: HelpCircle, color: "var(--color-dg-text-muted)" };
  }
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

// ============================================
// Componente de preview en vivo (snapshots)
// ============================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";

/**
 * URL pública heredada del preview. Solo sirve mientras el bucket `capturas`
 * siga siendo público — es decir, mientras cualquiera con la URL pueda ver la
 * cámara en vivo. Se usa como fallback para que un edge todavía sin
 * actualizar siga mostrando imagen.
 */
const SNAPSHOT_PATH_PUBLICO = "storage/v1/object/public/capturas/live_preview.jpg";

/** Añade el parámetro de cache-busting respetando la query ya existente. */
function conCacheBusting(url: string, ts: number): string {
  return `${url}${url.includes("?") ? "&" : "?"}t=${ts}`;
}

function LiveSnapshotPreview({
  camaraActiva,
  cameraId,
  previewUrl,
}: {
  camaraActiva: boolean;
  cameraId: CameraId;
  /** URL firmada publicada por el edge en estado_sistema.camaras */
  previewUrl?: string;
}) {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // Polling: refrescar la imagen cada 2s con cache-busting.
  //
  // La URL BASE la publica el edge (firmada, con caducidad) y se renueva sola
  // en cada heartbeat; aquí solo se le añade el timestamp para que el
  // navegador no sirva el frame anterior desde caché.
  //
  // Si el edge todavía no publica preview_url, se cae a la URL pública
  // heredada para no quedarnos sin imagen durante la migración.
  useEffect(() => {
    if (!camaraActiva) return;

    const base = previewUrl || (SUPABASE_URL ? `${SUPABASE_URL}/${SNAPSHOT_PATH_PUBLICO}` : "");
    if (!base) return;

    const updateUrl = () => {
      const ts = Date.now();
      setSnapshotUrl(conCacheBusting(base, ts));
      setLastUpdate(ts);
      setImgError(false);
    };

    // Primera carga inmediata
    updateUrl();

    const interval = setInterval(updateUrl, 2000);
    return () => clearInterval(interval);
  }, [camaraActiva, previewUrl]);

  // Cámara inactiva — placeholder de desconectada
  if (!camaraActiva) {
    return (
      <div className="cyber-card overflow-hidden">
        <div className="aspect-video bg-dg-bg flex flex-col items-center justify-center gap-2 text-dg-text-muted" role="status">
          <VideoOff className="w-8 h-8 opacity-40" aria-hidden="true" />
          <span className="text-sm font-medium">Cámara desconectada</span>
          <span className="text-xs text-dg-text-muted">Compruebe el terminal de acceso</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cyber-card overflow-hidden relative group">
      {/*
        Cabecera honesta.

        Aqui NO hay video en directo: son imagenes sueltas, una cada dos
        segundos, porque el enlace WebRTC no se pudo establecer. Antes esta
        cabecera mostraba el mismo punto rojo parpadeante y el mismo rotulo
        "EN VIVO" que el streaming de verdad, y el unico aviso estaba abajo,
        en blanco al 40% sobre un degradado. Un operador podia tomar una
        decision de seguridad creyendo que veia la escena en directo.
      */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-1.5 rounded-full border border-dg-warning/40 bg-dg-warning/15 px-2 py-0.5 backdrop-blur-sm">
          <ImageIcon className="h-3 w-3 text-dg-warning" aria-hidden="true" />
          <span className="text-2xs font-bold uppercase text-dg-warning">
            Vista reducida
          </span>
        </div>
        {lastUpdate > 0 && (
          <span className="text-2xs text-white/70 font-mono tabular">
            {new Date(lastUpdate).toLocaleTimeString("es", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: true
            })}
          </span>
        )}
      </div>

      {/* Imagen del snapshot */}
      {snapshotUrl && !imgError ? (
        <img
          src={snapshotUrl}
          alt="Última imagen capturada por la cámara de acceso"
          className="w-full aspect-video object-contain bg-dg-canvas"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="aspect-video bg-dg-bg flex flex-col items-center justify-center gap-2 text-dg-text-muted">
          <div className="w-6 h-6 border-2 border-dg-info border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">
            {imgError ? "Sin imagen de la cámara" : "Conectando…"}
          </span>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-gradient-to-t from-black/75 to-transparent">
        <span className="text-2xs font-medium text-white/80">
          No es vídeo en directo · 1 imagen cada 2 s
        </span>
      </div>
    </div>
  );
}
