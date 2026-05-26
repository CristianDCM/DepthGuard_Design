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

import { useEffect, useRef, useState } from "react";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
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
}

// ──────────────────────────────────────────────
// Componente
// ──────────────────────────────────────────────

export default function WebRTCPlayer({
  cameraId,
  edgeOnline,
  onFallback,
}: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<ConnectionStatus>("iniciando");

  useEffect(() => {
    // Corrección #5: si el edge está offline, no intentar WebRTC
    if (!edgeOnline) {
      onFallback();
      return;
    }

    // Generar un ID único para esta sesión de señalización
    const sessionId = `${cameraId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
          onFallback();
        }
      };

      // Suscripción a Supabase Broadcast para señalización
      canal = supabase.channel(canalNombre);

      // Manejar mensajes del edge (answer + ice_candidates)
      canal.on("broadcast", { event: "signal" }, async (msg) => {
        if (!pc || desmontado) return;
        const payload = msg.payload as Record<string, unknown>;

        // Solo procesar mensajes destinados a esta sesión
        if (payload.session_id !== sessionId) return;

        console.log(`[WebRTCPlayer] Recibido: tipo=${payload.tipo}, session=${sessionId.slice(0, 12)}`);

        if (payload.tipo === "answer") {
          const sdp = payload.sdp as string;
          console.log(`[WebRTCPlayer] Answer SDP recibida (${sdp.length} chars), contiene candidatos: ${sdp.includes("a=candidate:")}`);
          await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp }));
          console.log(`[WebRTCPlayer] remoteDescription asignada, connectionState=${pc.connectionState}`);
        } else if (payload.tipo === "ice_candidate") {
          const candidateData = payload.candidate as RTCIceCandidateInit | null;
          if (candidateData?.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidateData));
          }
        }
      });

      await new Promise<void>((resolve, reject) => {
        canal!.subscribe((status, err) => {
          console.log(`[WebRTCPlayer] Supabase canal status: ${status}`);
          if (status === "SUBSCRIBED") {
            resolve();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reject(err || new Error(`Error de suscripción: ${status}`));
          }
        });
      });
      console.log(`[WebRTCPlayer] Suscrito a canal '${canalNombre}'. Generando offer...`);

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
      console.log(`[WebRTCPlayer] ICE gathering completado. Enviando offer con candidates embebidos.`);
      console.log(`[WebRTCPlayer] SDP offer (${pc.localDescription!.sdp.length} chars), candidates: ${pc.localDescription!.sdp.includes('a=candidate:')}`);
      const sendResult = canal.send({
        type: "broadcast",
        event: "signal",
        payload: {
          tipo: "offer",
          session_id: sessionId,
          sdp: pc.localDescription!.sdp,
        },
      });
      console.log(`[WebRTCPlayer] canal.send() retornó:`, sendResult);

      // Iniciar timer de fallback (5 segundos)
      fallbackTimer = setTimeout(() => {
        if (desmontado) return;
        const state = pc?.connectionState;
        if (state !== "connected") {
          setStatus("fallback");
          onFallback();
        }
      }, WEBRTC_TIMEOUT_MS);
    }

    iniciarWebRTC().catch((err) => {
      console.error("[WebRTCPlayer] Error al iniciar:", err);
      setStatus("error");
      onFallback();
    });

    // Corrección #3: Cleanup completo al desmontar
    return () => {
      desmontado = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (canal) supabase.removeChannel(canal);
      if (pc) pc.close();
    };
  }, [cameraId, edgeOnline, onFallback]);

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div className="cyber-card overflow-hidden relative">
      {/* Video element — oculto hasta conectar */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full aspect-video object-cover bg-black transition-opacity duration-500 ${
          status === "conectado" ? "opacity-100" : "opacity-0 absolute"
        }`}
      />

      {/* Overlay de estado mientras conecta */}
      {status !== "conectado" && (
        <div className="aspect-video flex flex-col items-center justify-center gap-3 bg-dg-bg text-dg-text-muted">
          {status === "iniciando" || status === "conectando" ? (
            <>
              <Loader2 className="w-7 h-7 text-dg-accent animate-spin" />
              <span className="text-xs font-medium">
                {status === "iniciando" ? "Iniciando WebRTC..." : "Estableciendo conexión P2P..."}
              </span>
              <span className="text-[9px] text-dg-text-muted/50 font-mono">
                Timeout en {WEBRTC_TIMEOUT_MS / 1000}s → fallback a snapshot
              </span>
            </>
          ) : (
            <>
              <WifiOff className="w-7 h-7 text-dg-error opacity-60" />
              <span className="text-xs font-medium text-dg-error/80">
                WebRTC no disponible
              </span>
            </>
          )}
        </div>
      )}

      {/* Header del preview — solo visible cuando hay video */}
      {status === "conectado" && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_6px_#ef4444]" />
            <span className="text-[10px] font-bold text-white/90 uppercase tracking-widest">
              En Vivo
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/40 px-2 py-0.5 rounded-full">
            <Wifi className="w-3 h-3 text-dg-accent" />
            <span className="text-[9px] font-bold text-dg-accent uppercase tracking-wider">
              WebRTC P2P
            </span>
          </div>
        </div>
      )}

      {/* Footer sutil */}
      {status === "conectado" && (
        <div className="absolute bottom-0 left-0 right-0 px-3 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
          <span className="text-[9px] text-white/40 font-medium">
            Streaming en tiempo real · ~30 FPS
          </span>
        </div>
      )}
    </div>
  );
}
