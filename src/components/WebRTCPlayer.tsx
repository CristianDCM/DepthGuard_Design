/**
 * WebRTCPlayer — Componente de streaming de video en tiempo real.
 *
 * Flujo:
 *  1. Si edgeOnline === false → fallback inmediato (Corrección #5).
 *  2. Crea RTCPeerConnection con STUN (Google) + TURN (Metered).
 *  3. Se suscribe al canal Broadcast: webrtc-signaling-{cameraId} (Corrección #1).
 *  4. Genera un SDP offer y lo envía por Broadcast.
 *  5. Espera la SDP answer y candidatos ICE del edge.
 *  6. Asigna el track de video entrante a un <video>.
 *  7. Si en 5s el estado no llega a "connected" → onFallback().
 *  8. Cleanup completo al desmontar (Corrección #3).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Wifi, VideoOff, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import type { CameraId } from "../lib/supabase";

// ──────────────────────────────────────────────
// Configuración ICE (STUN + TURN)
// ──────────────────────────────────────────────

const ICE_SERVERS: RTCIceServer[] = [
  {
    urls: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
    ],
  },
  // TURN de Metered — solo activo si las variables de entorno están configuradas
  ...(import.meta.env.VITE_TURN_URL
    ? [
        {
          urls: [
            import.meta.env.VITE_TURN_URL as string,
            (import.meta.env.VITE_TURN_URL as string).replace(":80", ":443"),
            (import.meta.env.VITE_TURN_URL as string).replace("turn:", "turns:"),
          ],
          username: import.meta.env.VITE_TURN_USERNAME as string,
          credential: import.meta.env.VITE_TURN_CREDENTIAL as string,
        },
      ]
    : []),
];

// Timeout para fallback si WebRTC no conecta (ms)
const WEBRTC_TIMEOUT_MS = 10_000;

/**
 * Canal de señalización privado (hallazgo C2). Debe activarse a la vez que
 * WEBRTC_CANAL_PRIVADO en el .env del edge, y después de aplicar
 * supabase/rls_realtime.sql.
 */
const CANAL_PRIVADO =
  (import.meta.env.VITE_WEBRTC_CANAL_PRIVADO ?? "false").toString().toLowerCase() === "true";

// ──────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────

type ConnectionStatus =
  | "iniciando"
  | "conectando"
  | "conectado"
  | "fallback"
  | "error";

interface WebRTCPlayerProps {
  cameraId: CameraId;
  edgeOnline: boolean;
  onFallback: () => void;
  /** Oculta overlays (EN VIVO, WEBRTC P2P, FPS). Ideal para registro. */
  minimal?: boolean;
  /**
   * "bare" elimina la tarjeta, la relacion de aspecto y los mensajes de
   * estado propios: el video llena al contenedor y quien manda es el padre.
   * Lo usa BiometricFrame, que dibuja su propio marco encima.
   */
  variante?: "card" | "bare";
}

// ──────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────

export default function WebRTCPlayer({
  cameraId,
  edgeOnline,
  onFallback,
  minimal = false,
  variante = "card",
}: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<ConnectionStatus>("iniciando");

  // Ref estable para onFallback — evita que re-renders del padre
  // re-ejecuten el useEffect y destruyan la conexión WebRTC en curso.
  const onFallbackRef = useRef(onFallback);
  useEffect(() => { onFallbackRef.current = onFallback; }, [onFallback]);

  useEffect(() => {
    // Corrección #5: si el edge está offline, no intentar WebRTC
    if (!edgeOnline) {
      onFallbackRef.current();
      return;
    }

    // Generar un ID único para esta sesión de señalización de forma criptográficamente segura
    const sessionId = `${cameraId}-${Date.now()}-${crypto.randomUUID().split('-')[0]}`;
    const canalNombre = `webrtc-signaling-${cameraId}`;

    // Referencias para el cleanup
    let pc: RTCPeerConnection | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let canal: ReturnType<typeof supabase.channel> | null = null;
    let desmontado = false;

    async function iniciarWebRTC() {
      setStatus("conectando");

      // Crear RTCPeerConnection
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      // Recibir el track de video del edge
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
        }
      };

      // Observar cambios de estado de conexión
      pc.onconnectionstatechange = () => {
        if (!pc || desmontado) return;
        const state = pc.connectionState;

        if (state === "connected") {
          setStatus("conectado");
          if (fallbackTimer) {
            clearTimeout(fallbackTimer);
            fallbackTimer = null;
          }
        } else if (state === "failed" || state === "closed") {
          setStatus("fallback");
          onFallbackRef.current();
        }
      };

      // Suscripción a Supabase Broadcast para señalización.
      //
      // Con CANAL_PRIVADO el canal es PRIVADO: Supabase evalúa la RLS de
      // realtime.messages antes de dejar entrar o publicar, así que solo un
      // usuario con sesión iniciada puede pedir vídeo. El canal público es el
      // hallazgo C2: su nombre es predecible (webrtc-signaling-{cameraId}) y
      // cualquiera que se suscribiera obtenía la cámara en vivo.
      //
      // Va tras una variable de entorno porque el edge tiene su propio flag
      // (WEBRTC_CANAL_PRIVADO) y los dos extremos deben cambiar A LA VEZ: no
      // está documentado que un cliente privado y uno público se vean en el
      // mismo topic, y dar por hecho que sí dejaría el monitor sin vídeo.
      //
      // setAuth() es imprescindible para el canal privado: sin él la conexión
      // Realtime no lleva el JWT de la sesión y la RLS no tiene identidad
      // contra la que evaluar. En canal público es inocuo.
      await supabase.realtime.setAuth();
      canal = CANAL_PRIVADO
        ? supabase.channel(canalNombre, { config: { private: true } })
        : supabase.channel(canalNombre);

      // Manejar mensajes del edge (answer + ice_candidates)
      canal.on("broadcast", { event: "signal" }, async (msg) => {
        if (!pc || desmontado) return;
        const payload = msg.payload as Record<string, unknown>;

        // Solo procesar mensajes destinados a esta sesión
        if (payload.session_id !== sessionId) return;


        if (payload.tipo === "answer") {
          const sdp = payload.sdp as string;
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp }));
        } else if (payload.tipo === "ice_candidate") {
          const candidateData = payload.candidate as RTCIceCandidateInit | null;
          if (candidateData?.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidateData));
          }
        }
      });

      await new Promise<void>((resolve, reject) => {
        canal!.subscribe((status, err) => {
          if (status === "SUBSCRIBED") {
            resolve();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reject(err || new Error(`Error de suscripción: ${status}`));
          }
        });
      });

      // NO enviar candidates individuales (Trickle ICE).
      // aiortc en el backend NO soporta Trickle ICE —
      // los candidates deben ir embebidos en el SDP de la offer.
      // Se esperará a ICE gathering completo antes de enviar.

      // Generar offer y esperar ICE gathering completo.
      // aiortc NO soporta Trickle ICE — candidates deben ir embebidos en el SDP.
      const offer = await pc.createOffer({ offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);

      // Esperar a que el navegador recolecte todos los ICE candidates
      await new Promise<void>((resolve) => {
        if (pc!.iceGatheringState === "complete") {
          resolve();
          return;
        }
        const check = () => {
          if (pc!.iceGatheringState === "complete") {
            pc!.removeEventListener("icegatheringstatechange", check);
            resolve();
          }
        };
        pc!.addEventListener("icegatheringstatechange", check);
        // Safety timeout — si no termina en 5s, enviar lo que haya
        setTimeout(() => {
          pc!.removeEventListener("icegatheringstatechange", check);
          resolve();
        }, 5000);
      });

      if (desmontado) return;

      // Ahora el SDP tiene todos los candidates embebidos
      canal.send({
        type: "broadcast",
        event: "signal",
        payload: {
          tipo: "offer",
          session_id: sessionId,
          sdp: pc.localDescription!.sdp,
        },
      });

      // Iniciar timer de fallback (5 segundos)
      fallbackTimer = setTimeout(() => {
        if (desmontado) return;
        const state = pc?.connectionState;
        if (state !== "connected") {
          setStatus("fallback");
          onFallbackRef.current();
        }
      }, WEBRTC_TIMEOUT_MS);
    }

    iniciarWebRTC().catch((err) => {
      console.error("[WebRTCPlayer] Error al iniciar:", err);
      setStatus("error");
      onFallbackRef.current();
    });

    // Corrección #3: Cleanup completo al desmontar
    return () => {
      desmontado = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (canal) supabase.removeChannel(canal);
      if (pc) pc.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraId, edgeOnline]);

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  const bare = variante === "bare";

  return (
    <div className={bare ? "relative h-full w-full" : "cyber-card overflow-hidden relative"}>
      {/* Video element — oculto hasta conectar */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        aria-label="Vídeo en directo de la cámara de acceso"
        className={`${
          bare ? "h-full w-full object-cover" : "w-full aspect-video object-contain"
        } bg-dg-canvas transition-opacity duration-500 ${
          status === "conectado" ? "opacity-100" : "opacity-0 absolute"
        }`}
      />

      {/*
        Overlay mientras conecta.

        El texto ya no cuenta la fontaneria: antes decia "Iniciando
        WebRTC...", "Estableciendo conexion P2P..." y, en letra pequena,
        "Timeout en 10s -> fallback a snapshot". Ningun producto explica su
        plan B al usuario con una flecha ASCII.
      */}
      {status !== "conectado" && (
        <div
          className={`${
            bare ? "absolute inset-0" : "aspect-video"
          } flex flex-col items-center justify-center gap-3 bg-dg-bg text-dg-text-muted`}
          role="status"
        >
          {status === "iniciando" || status === "conectando" ? (
            <>
              <Loader2 className="h-7 w-7 text-dg-info animate-spin" aria-hidden="true" />
              <span className="text-sm font-medium">Conectando con la cámara…</span>
            </>
          ) : (
            <>
              <VideoOff className="h-7 w-7 text-dg-text-muted" aria-hidden="true" />
              <span className="max-w-[16rem] text-center text-sm font-medium text-dg-text-secondary">
                No se pudo abrir el vídeo en directo
              </span>
            </>
          )}
        </div>
      )}

      {/* Cabecera del preview — solo con video y fuera de los modos minimal/bare */}
      {status === "conectado" && !minimal && !bare && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-dg-error animate-pulse shadow-[0_0_6px_var(--color-dg-error)]" aria-hidden="true" />
            <span className="text-2xs font-bold text-white/90 uppercase">
              En Vivo
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-full">
            <Wifi className="w-3 h-3 text-dg-success" aria-hidden="true" />
            <span className="text-2xs font-bold text-dg-success uppercase">
              Directo
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
