import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, Download, X, Share } from "lucide-react";
import { registerSW } from "virtual:pwa-register";

/**
 * Tres cosas que una PWA debe decir y esta no decía ninguna:
 * si hay conexión, si hay una versión nueva y que se puede instalar.
 */

const CLAVE_RECHAZO = "dg_instalacion_rechazada";

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** iOS nunca dispara beforeinstallprompt: allí hay que explicarlo a mano. */
function esIosSinInstalar(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const esIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && "ontouchend" in document);
  const yaInstalada = (navigator as { standalone?: boolean }).standalone === true;
  return esIos && !yaInstalada;
}

export default function EstadoPwa() {
  const [sinConexion, setSinConexion] = useState(() =>
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [hayActualizacion, setHayActualizacion] = useState(false);
  const [actualizar, setActualizar] = useState<(() => void) | null>(null);
  const [instalacion, setInstalacion] = useState<EventoInstalacion | null>(null);
  const [guiaIos, setGuiaIos] = useState(false);

  // ── Conexión ──────────────────────────────────────────────────────────
  useEffect(() => {
    const on = () => setSinConexion(false);
    const off = () => setSinConexion(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // ── Service Worker ────────────────────────────────────────────────────
  useEffect(() => {
    // registerType 'prompt': no se activa una versión nueva por sorpresa
    // mientras alguien está vigilando una cámara.
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        setHayActualizacion(true);
        setActualizar(() => () => update(true));
      },
    });
  }, []);

  // ── Instalación ───────────────────────────────────────────────────────
  useEffect(() => {
    let rechazada = false;
    try {
      rechazada = localStorage.getItem(CLAVE_RECHAZO) === "1";
    } catch { /* almacenamiento bloqueado */ }
    if (rechazada) return;

    const alPoder = (e: Event) => {
      e.preventDefault();
      setInstalacion(e as EventoInstalacion);
    };
    window.addEventListener("beforeinstallprompt", alPoder);

    // En iOS el evento no llega nunca: se ofrece la guía manual.
    if (esIosSinInstalar()) setGuiaIos(true);

    return () => window.removeEventListener("beforeinstallprompt", alPoder);
  }, []);

  const descartarInstalacion = () => {
    setInstalacion(null);
    setGuiaIos(false);
    try {
      localStorage.setItem(CLAVE_RECHAZO, "1");
    } catch { /* la preferencia no persiste */ }
  };

  return (
    <>
      {/* Sin conexión: barra permanente, porque lo que se ve en pantalla
          deja de refrescarse y nadie deberia decidir sobre ello a ciegas. */}
      {sinConexion && (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-[65] flex items-center justify-center gap-2 bg-dg-warning px-4 py-1.5 text-2xs font-bold text-dg-bg pt-safe"
        >
          <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
          Sin conexión · los datos en pantalla no se están actualizando
        </div>
      )}

      {hayActualizacion && (
        <Aviso
          icono={<RefreshCw className="h-4 w-4 text-dg-action-text" aria-hidden="true" />}
          titulo="Hay una versión nueva"
          cuerpo="Se aplicará al recargar."
          accion={{ etiqueta: "Actualizar", alPulsar: () => actualizar?.() }}
          alCerrar={() => setHayActualizacion(false)}
          desplazado={sinConexion}
        />
      )}

      {instalacion && (
        <Aviso
          icono={<Download className="h-4 w-4 text-dg-action-text" aria-hidden="true" />}
          titulo="Instalar DepthGuard"
          cuerpo="Se abre como una aplicación, sin barra del navegador."
          accion={{
            etiqueta: "Instalar",
            alPulsar: async () => {
              await instalacion.prompt();
              await instalacion.userChoice;
              setInstalacion(null);
            },
          }}
          alCerrar={descartarInstalacion}
          desplazado={sinConexion}
        />
      )}

      {guiaIos && !instalacion && (
        <Aviso
          icono={<Share className="h-4 w-4 text-dg-action-text" aria-hidden="true" />}
          titulo="Añadir a la pantalla de inicio"
          cuerpo="Toque Compartir y luego «Añadir a pantalla de inicio»."
          alCerrar={descartarInstalacion}
          desplazado={sinConexion}
        />
      )}
    </>
  );
}

function Aviso({
  icono,
  titulo,
  cuerpo,
  accion,
  alCerrar,
  desplazado,
}: {
  icono: React.ReactNode;
  titulo: string;
  cuerpo: string;
  accion?: { etiqueta: string; alPulsar: () => void };
  alCerrar: () => void;
  desplazado: boolean;
}) {
  return (
    <div
      className={`fixed inset-x-0 z-[64] px-3 ${desplazado ? "top-9" : "top-0 pt-safe"}`}
      role="status"
    >
      <div className="mx-auto mt-2 flex max-w-xl items-center gap-3 rounded-dg border border-dg-border bg-dg-card px-4 py-2.5 shadow-dg-lg">
        <span className="shrink-0">{icono}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-dg-text">{titulo}</p>
          <p className="truncate text-xs text-dg-text-muted">{cuerpo}</p>
        </div>
        {accion && (
          <button
            onClick={accion.alPulsar}
            className="shrink-0 rounded-dg bg-dg-action px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-dg-action-hover"
          >
            {accion.etiqueta}
          </button>
        )}
        <button
          onClick={alCerrar}
          aria-label={`Cerrar aviso: ${titulo}`}
          className="shrink-0 rounded-dg-sm p-1 text-dg-text-muted transition-colors hover:text-dg-text"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
