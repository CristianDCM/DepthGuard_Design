import { useEffect, useState } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Navigation from "../components/Navigation";
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

// ============================================
// Tipos locales
// ============================================

interface CameraPanelData {
  cameraId: CameraId;
  cameraType: CameraType;
  label: string;
  ultimoEvento: Evento | null;
  eventosRecientes: Evento[];
}

// ============================================
// Componente principal
// ============================================

export default function LiveMonitor() {
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [panelPrincipal, setPanelPrincipal] = useState<CameraPanelData>({
    cameraId: "entrada_principal",
    cameraType: "3D",
    label: "Entrada Principal",
    ultimoEvento: null,
    eventosRecientes: [],
  });
  const [panelSecundario, setPanelSecundario] = useState<CameraPanelData>({
    cameraId: "entrada_secundaria",
    cameraType: "2D",
    label: "Entrada Secundaria",
    ultimoEvento: null,
    eventosRecientes: [],
  });
  const [loading, setLoading] = useState(true);

  // Cargar datos iniciales
  useEffect(() => {
    async function cargarDatos() {
      try {
        const [estadoData, eventosPrincipal, eventosSecundario] =
          await Promise.all([
            getEstadoSistema(),
            getEventosPorCamara("entrada_principal", 5),
            getEventosPorCamara("entrada_secundaria", 5),
          ]);

        if (estadoData) {
          setEstado(estadoData);

          // Actualizar tipo de cámara desde el heartbeat real
          const camPrincipal = estadoData.camaras.find(c => c.camera_id === "entrada_principal");
          const camSecundaria = estadoData.camaras.find(c => c.camera_id === "entrada_secundaria");

          if (camPrincipal) {
            setPanelPrincipal(prev => ({ ...prev, cameraType: camPrincipal.camera_type }));
          }
          if (camSecundaria) {
            setPanelSecundario(prev => ({ ...prev, cameraType: camSecundaria.camera_type }));
          }
        }

        setPanelPrincipal((prev) => ({
          ...prev,
          ultimoEvento: eventosPrincipal[0] ?? null,
          eventosRecientes: eventosPrincipal,
        }));

        setPanelSecundario((prev) => ({
          ...prev,
          ultimoEvento: eventosSecundario[0] ?? null,
          eventosRecientes: eventosSecundario,
        }));
      } catch (err) {
        console.error("Error cargando monitor:", err);
      } finally {
        setLoading(false);
      }
    }
    cargarDatos();
  }, []);

  // Suscripción Realtime — escucha INSERTs en historial y rutea al panel correcto
  useEffect(() => {
    const channel = supabase
      .channel("live-monitor-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "historial" },
        (payload) => {
          const nuevoEvento = payload.new as Evento;

          if (nuevoEvento.camera_id === "entrada_principal") {
            setPanelPrincipal((prev) => ({
              ...prev,
              ultimoEvento: nuevoEvento,
              eventosRecientes: [nuevoEvento, ...prev.eventosRecientes].slice(0, 5),
            }));
          } else if (nuevoEvento.camera_id === "entrada_secundaria") {
            setPanelSecundario((prev) => ({
              ...prev,
              ultimoEvento: nuevoEvento,
              eventosRecientes: [nuevoEvento, ...prev.eventosRecientes].slice(0, 5),
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Polling del heartbeat cada 30s
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const estadoData = await getEstadoSistema();
        if (estadoData) setEstado(estadoData);
      } catch {
        /* silenciar */
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const edgeOnline = isEdgeOnline(estado?.ultimo_heartbeat ?? null);
  const camaras = estado?.camaras ?? [];

  // Buscar estado real de cada cámara desde el array del heartbeat
  const camEstadoPrincipal = camaras.find(c => c.camera_id === "entrada_principal");
  const camEstadoSecundario = camaras.find(c => c.camera_id === "entrada_secundaria");

  const principalActiva = camEstadoPrincipal
    ? isCamaraActiva(camEstadoPrincipal, estado?.ultimo_heartbeat ?? null)
    : false;
  const secundariaActiva = camEstadoSecundario
    ? isCamaraActiva(camEstadoSecundario, estado?.ultimo_heartbeat ?? null)
    : false;

  return (
    <div className="min-h-screen pb-24 flex flex-col bg-dg-bg">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Video className="w-6 h-6 text-dg-accent" />
            <h1 className="text-xl font-bold tracking-tight font-headline">
              Monitor en Vivo
            </h1>
          </div>
          {/* Edge Status Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
              edgeOnline
                ? "bg-dg-accent/10 border-dg-accent/20"
                : "bg-dg-error/10 border-dg-error/20"
            }`}
          >
            <Server className={`w-3.5 h-3.5 ${edgeOnline ? "text-dg-accent" : "text-dg-error"}`} />
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                edgeOnline
                  ? "bg-dg-accent shadow-[0_0_6px_#a3ff00] animate-pulse"
                  : "bg-dg-error"
              }`}
            />
            <span
              className={`text-[10px] font-bold tracking-widest uppercase ${
                edgeOnline ? "text-dg-accent" : "text-dg-error"
              }`}
            >
              {edgeOnline ? "Edge Online" : "Edge Offline"}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-dg-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CameraPanel data={panelPrincipal} camaraActiva={principalActiva} edgeOnline={edgeOnline} />
            <CameraPanel data={panelSecundario} camaraActiva={secundariaActiva} edgeOnline={edgeOnline} />
          </div>
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
}: {
  data: CameraPanelData;
  camaraActiva: boolean;
  edgeOnline: boolean;
}) {
  const { cameraId, cameraType, label, ultimoEvento, eventosRecientes } = data;
  const statusConfig = getStatusConfig(ultimoEvento);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: cameraId === "entrada_principal" ? 0 : 0.15,
      }}
      className="space-y-4"
    >
      {/* Camera Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              cameraType === "3D"
                ? "bg-dg-accent/10 border border-dg-accent/20"
                : "bg-blue-500/10 border border-blue-500/20"
            }`}
          >
            {cameraType === "3D" ? (
              <Shield className="w-5 h-5 text-dg-accent" />
            ) : (
              <Eye className="w-5 h-5 text-blue-400" />
            )}
          </div>
          <div>
            <h2 className="font-headline text-base font-bold tracking-tight">
              {label}
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                  cameraType === "3D"
                    ? "bg-dg-accent/10 text-dg-accent"
                    : "bg-blue-500/10 text-blue-400"
                }`}
              >
                {cameraType === "3D" ? "Anti-spoofing 3D" : "Verificación 2D"}
              </span>
              <span
                className={`flex items-center gap-1 text-[9px] font-bold uppercase ${
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

      {/* Live Preview Snapshot */}
      <LiveSnapshotPreview camaraActiva={camaraActiva} cameraId={cameraId} />

      {/* Status Card — el evento actual */}
      <div
        className={`cyber-card relative overflow-hidden ${
          statusConfig.borderClass
        }`}
      >
        {/* Glow effect for alerts */}
        {ultimoEvento?.estado === "FRAUDE" && (
          <div className="absolute inset-0 bg-dg-error/5 animate-pulse pointer-events-none" />
        )}

        <div className="p-5 relative z-10">
          <div className="flex items-start justify-between">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5" style={{ color: statusConfig.accentColor }}>
                <statusConfig.icon className="w-4 h-4" />
                <span className="text-[10px] font-bold tracking-widest uppercase">
                  Estatus de Seguridad
                </span>
              </div>
              <h3 className="font-headline text-xl font-bold text-white uppercase tracking-tight">
                {statusConfig.title}
              </h3>
              {ultimoEvento?.nombre && (
                <div className="flex items-center gap-2 mt-2 bg-dg-bg p-2.5 rounded-lg border border-dg-border">
                  <div className="w-8 h-8 rounded-full bg-dg-accent/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-dg-accent" />
                  </div>
                  <div>
                    <div className="text-[9px] text-dg-text-muted uppercase font-bold tracking-wider">
                      Sujeto
                    </div>
                    <div className="text-sm font-bold text-white">
                      {ultimoEvento.nombre}
                    </div>
                  </div>
                </div>
              )}
              {ultimoEvento?.motivo && (
                <p className="text-xs text-dg-error/80 mt-1 font-medium">
                  {ultimoEvento.motivo}
                </p>
              )}
            </div>
            {/* Confidence Badge */}
            {ultimoEvento?.confianza != null && (
              <div className="bg-dg-bg px-3 py-2 rounded-lg border border-dg-border flex flex-col items-end shrink-0">
                <span className="text-[9px] text-dg-text-muted font-bold uppercase">
                  Confianza
                </span>
                <span
                  className="text-xl font-headline font-black"
                  style={{ color: statusConfig.accentColor }}
                >
                  {Math.round(ultimoEvento.confianza * 100)}%
                </span>
              </div>
            )}
          </div>
          {/* Timestamp */}
          {ultimoEvento && (
            <div className="mt-3 text-[10px] text-dg-text-muted font-medium">
              {formatRelativeTime(ultimoEvento.timestamp)}
            </div>
          )}
        </div>
      </div>

      {/* Anti-spoofing Metrics (solo si hay evento con métricas) */}
      {ultimoEvento?.metricas_json && (
        <div className="cyber-card p-4">
          <h4 className="text-[10px] font-bold text-dg-text-muted uppercase tracking-[0.15em] mb-4">
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
              color="bg-blue-500"
            />
            {cameraType === "3D" && (
              <MetricBar
                label="Píxeles Válidos"
                value={`${Math.round((ultimoEvento.metricas_json.pixeles_validos ?? 0) * 100)}%`}
                progress={(ultimoEvento.metricas_json.pixeles_validos ?? 0) * 100}
                color="bg-violet-500"
              />
            )}
          </div>
        </div>
      )}

      {/* Mini Event Log */}
      <div className="cyber-card overflow-hidden">
        <div className="px-4 py-3 border-b border-dg-border bg-white/5 flex items-center justify-between">
          <h4 className="text-[10px] font-bold text-dg-text-muted uppercase tracking-[0.15em]">
            Últimos Eventos
          </h4>
          <span className="text-[9px] text-dg-text-muted font-medium">
            {eventosRecientes.length} registros
          </span>
        </div>
        <div className="divide-y divide-dg-border">
          <AnimatePresence mode="popLayout">
            {eventosRecientes.length === 0 ? (
              <div className="p-6 text-center text-dg-text-muted text-xs">
                Sin eventos registrados
              </div>
            ) : (
              eventosRecientes.slice(0, 4).map((evento) => (
                <div key={evento.id}>
                  <MiniEventRow evento={evento} />
                </div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Connection footer */}
      <div className="flex items-center justify-between cyber-card p-3">
        <div className="flex items-center gap-2">
          <div className="relative w-6 h-6 flex items-center justify-center bg-dg-accent/10 rounded-md">
            <Cloud className="w-3.5 h-3.5 text-dg-accent" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-dg-accent rounded-full border border-dg-card animate-pulse" />
          </div>
          <div>
            <div className="text-[8px] font-bold text-dg-text-muted uppercase tracking-wider">
              Supabase Realtime
            </div>
            <div className="text-[10px] font-bold text-dg-accent flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-dg-accent" />
              Suscrito
            </div>
          </div>
        </div>
        <div className="text-[9px] px-2 py-1 rounded bg-white/5 font-mono text-dg-text-muted">
          {cameraId === "entrada_principal" ? "CAM-01" : "CAM-02"} ·{" "}
          {cameraType}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================
// Sub-componentes
// ============================================

function MiniEventRow({ evento }: { evento: Evento }) {
  const config = getEventMiniConfig(evento);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
    >
      <div
        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
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
        <p className="text-[10px] text-dg-text-muted truncate">
          {evento.nombre ?? evento.motivo ?? "Persona no registrada"}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span className="text-[10px] text-dg-text-muted font-medium">
          {formatTime(evento.timestamp)}
        </span>
        {evento.confianza != null && (
          <p className="text-[9px] font-bold text-dg-text-muted/60">
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
  color = "bg-dg-accent",
}: {
  label: string;
  value: string | number;
  progress: number;
  color?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end">
        <span className="text-xs font-medium text-slate-300">{label}</span>
        <span className="text-[10px] font-mono text-dg-text-muted">
          {value}
        </span>
      </div>
      <div className="h-1.5 w-full bg-dg-bg rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(progress, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full ${color} rounded-full shadow-[0_0_8px_rgba(163,255,0,0.3)]`}
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
      accentColor: "#888888",
      borderClass: "",
    };
  }

  switch (evento.estado) {
    case "ACCESO_PERMITIDO":
      return {
        title: "Acceso Permitido",
        icon: CheckCircle,
        accentColor: "#4ade80",
        borderClass: "",
      };
    case "FRAUDE":
      return {
        title: "¡Fraude Detectado!",
        icon: ShieldAlert,
        accentColor: "#f87171",
        borderClass: "border-dg-error/30 shadow-[0_0_20px_rgba(248,113,113,0.1)]",
      };
    case "DESCONOCIDO":
      return {
        title: "Desconocido",
        icon: ShieldQuestion,
        accentColor: "#facc15",
        borderClass: "border-yellow-500/20",
      };
  }
}

function getEventMiniConfig(evento: Evento) {
  switch (evento.estado) {
    case "ACCESO_PERMITIDO":
      return { label: "Acceso Autorizado", icon: CheckCircle, color: "#4ade80" };
    case "FRAUDE":
      return { label: "Intento de Fraude", icon: AlertTriangle, color: "#f87171" };
    case "DESCONOCIDO":
      return { label: "Desconocido", icon: HelpCircle, color: "#facc15" };
  }
}

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(timestamp: string) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Hace un momento";
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;
  return new Date(timestamp).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ============================================
// Componente de preview en vivo (snapshots)
// ============================================

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SNAPSHOT_PATH = "storage/v1/object/public/capturas/live_preview.jpg";

function LiveSnapshotPreview({
  camaraActiva,
  cameraId,
}: {
  camaraActiva: boolean;
  cameraId: CameraId;
}) {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  // Solo el panel de la cámara principal muestra el snapshot
  // (el edge solo sube un snapshot, no uno por cámara)
  const isMainCamera = cameraId === "entrada_principal";

  // Polling: actualizar URL cada 2s con cache-busting
  useEffect(() => {
    if (!camaraActiva || !isMainCamera || !SUPABASE_URL) return;

    const updateUrl = () => {
      const ts = Date.now();
      setSnapshotUrl(`${SUPABASE_URL}/${SNAPSHOT_PATH}?t=${ts}`);
      setLastUpdate(ts);
      setImgError(false);
    };

    // Primera carga inmediata
    updateUrl();

    const interval = setInterval(updateUrl, 2000);
    return () => clearInterval(interval);
  }, [camaraActiva, isMainCamera]);

  // Si no es la cámara principal, no mostrar nada
  if (!isMainCamera) return null;

  // Cámara inactiva — placeholder
  if (!camaraActiva) {
    return (
      <div className="cyber-card overflow-hidden">
        <div className="aspect-video bg-dg-bg flex flex-col items-center justify-center gap-2 text-dg-text-muted">
          <Video className="w-8 h-8 opacity-30" />
          <span className="text-xs font-medium">Cámara desconectada</span>
        </div>
      </div>
    );
  }

  return (
    <div className="cyber-card overflow-hidden relative group">
      {/* Header del preview */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_#ef4444]" />
          <span className="text-[10px] font-bold text-white/90 uppercase tracking-widest">
            En Vivo
          </span>
        </div>
        {lastUpdate > 0 && (
          <span className="text-[9px] text-white/50 font-mono">
            {new Date(lastUpdate).toLocaleTimeString("es", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        )}
      </div>

      {/* Imagen del snapshot */}
      {snapshotUrl && !imgError ? (
        <img
          src={snapshotUrl}
          alt="Preview en vivo de la cámara"
          className="w-full aspect-video object-cover bg-black"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="aspect-video bg-dg-bg flex flex-col items-center justify-center gap-2 text-dg-text-muted">
          <div className="w-6 h-6 border-2 border-dg-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">
            {imgError ? "Esperando snapshot del edge..." : "Conectando..."}
          </span>
        </div>
      )}

      {/* Footer sutil */}
      <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
        <span className="text-[9px] text-white/40 font-medium">
          Actualización cada 2s · Resolución reducida
        </span>
      </div>
    </div>
  );
}
