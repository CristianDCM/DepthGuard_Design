import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  Info,
  Video,
  Users,
  Check,
  RotateCw,
  Hourglass,
  CheckCircle,
  ArrowLeft,
  AlertTriangle,
  WifiOff,
} from "lucide-react";
import { motion } from "motion/react";
import WebRTCPlayer from "../components/WebRTCPlayer";
import {
  crearUsuario,
  insertarComandoRegistro,
  suscribirComandoEstado,
  getComandoEstado,
  cancelarRegistroEdge,
  isEdgeOnline,
  getEstadoSistema,
  getUsuarios,
  type Usuario,
  type ComandoEdge,
  type EstadoComando,
  type CameraId,
} from "../lib/supabase";

// ============================================
// Configuración de ángulos de captura
// ============================================

const ANGULOS = [
  { step: 1, label: "Frontal", instruccion: "Mire directamente al frente" },
  { step: 2, label: "Izquierda", instruccion: "Gire la cabeza a su IZQUIERDA" },
  { step: 3, label: "Derecha", instruccion: "Gire la cabeza a su DERECHA" },
  { step: 4, label: "Arriba", instruccion: "Mire hacia ARRIBA" },
  { step: 5, label: "Abajo", instruccion: "Mire hacia ABAJO" },
];

export default function RegisterStart() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "waiting_edge" | "scanning" | "success" | "error">("form");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Scanning state — driven by real edge progress
  const [anguloActual, setAnguloActual] = useState(0);
  const [estadoComando, setEstadoComando] = useState<EstadoComando>("pendiente");

  // Resultado
  const [usuarioCreado, setUsuarioCreado] = useState<Usuario | null>(null);
  const [comandoId, setComandoId] = useState<string | null>(null);

  // WebRTC state
  const [activeCameraId, setActiveCameraId] = useState<CameraId | null>(null);
  const [webrtcFailed, setWebrtcFailed] = useState(false);

  // Cleanup ref for Realtime subscription
  const cleanupRef = useRef<(() => void) | null>(null);
  // Polling fallback interval
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ============================================
  // Lógica del formulario
  // ============================================

  const handleStartRegistration = async () => {
    if (!name.trim()) {
      setError("El nombre completo es obligatorio");
      return;
    }

    setError("");
    setIsSubmitting(true);
    setWebrtcFailed(false);

    try {
      // Verificar que el edge esté online
      const estado = await getEstadoSistema();
      if (!isEdgeOnline(estado.ultimo_heartbeat)) {
        setError("El nodo edge no está activo. Encienda el sistema DepthGuard antes de registrar.");
        setIsSubmitting(false);
        return;
      }

      // Guardar cámara activa para el WebRTC
      const camara = estado.camaras?.find(c => c.activa) || estado.camaras?.[0];
      if (camara) {
        setActiveCameraId(camara.id as CameraId);
      }

      // Verificar que no exista un usuario con el mismo nombre
      const usuariosExistentes = await getUsuarios();
      const duplicado = usuariosExistentes.find(
        (u) => u.nombre.toLowerCase().trim() === name.trim().toLowerCase()
      );
      if (duplicado) {
        setError(`Ya existe un usuario registrado con el nombre "${duplicado.nombre}".`);
        setIsSubmitting(false);
        return;
      }

      // 1. Crear usuario en Supabase (con 0 ángulos)
      const nuevoUsuario = await crearUsuario(name.trim(), notes.trim());
      setUsuarioCreado(nuevoUsuario);

      // 2. Insertar comando INICIAR_REGISTRO
      const comando = await insertarComandoRegistro(nuevoUsuario.id, name.trim());
      setComandoId(comando.id);

      // 3. Pasar a "esperando edge"
      setStep("waiting_edge");
      setEstadoComando("pendiente");

      // 4. Suscribirse a cambios del comando vía Realtime + polling fallback
      _iniciarMonitoreo(comando.id);

    } catch (err: any) {
      console.error("Error iniciando registro:", err);
      setError(err.message ?? "Error al crear el usuario. Intente de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // Monitoreo del comando (Realtime + polling)
  // ============================================

  const _iniciarMonitoreo = (cmdId: string) => {
    // Realtime subscription
    const unsub = suscribirComandoEstado(cmdId, _onComandoActualizado);
    cleanupRef.current = unsub;

    // Polling fallback cada 3s (por si Realtime falla)
    pollingRef.current = setInterval(async () => {
      try {
        const cmd = await getComandoEstado(cmdId);
        _onComandoActualizado(cmd);
      } catch { /* silent */ }
    }, 3000);
  };

  const _onComandoActualizado = (comando: ComandoEdge) => {
    setEstadoComando(comando.estado);
    setAnguloActual(comando.progreso);

    if (comando.estado === "en_progreso" && step !== "scanning") {
      setStep("scanning");
    }

    if (comando.estado === "completado") {
      _limpiarMonitoreo();
      setUsuarioCreado((prev) => prev ? { ...prev, num_angulos: comando.progreso } : null);
      setStep("success");
    }

    if (comando.estado === "error") {
      _limpiarMonitoreo();
      const msg = comando.resultado?.error ?? "Error desconocido en el edge";
      setError(msg);
      setStep("error");
    }

    if (comando.estado === "cancelado") {
      _limpiarMonitoreo();
      setStep("form");
    }
  };

  // Fix: allow _onComandoActualizado to read latest `step`
  const stepRef = useRef(step);
  stepRef.current = step;
  // Patch the condition to use ref
  const _onComandoActualizadoPatched = (comando: ComandoEdge) => {
    setEstadoComando(comando.estado);
    setAnguloActual(comando.progreso);

    if (comando.estado === "en_progreso") {
      setStep("scanning");
    }
    if (comando.estado === "completado") {
      _limpiarMonitoreo();
      setUsuarioCreado((prev) => prev ? { ...prev, num_angulos: comando.progreso } : null);
      setStep("success");
    }
    if (comando.estado === "error") {
      _limpiarMonitoreo();
      const msg = comando.resultado?.error ?? "Error desconocido en el edge";
      setError(msg);
      setStep("error");
    }
    if (comando.estado === "cancelado") {
      _limpiarMonitoreo();
      setStep("form");
    }
  };

  // Override to use patched version
  useEffect(() => {
    if (!comandoId) return;
    // Re-subscribe with patched handler
    cleanupRef.current?.();
    if (pollingRef.current) clearInterval(pollingRef.current);

    const unsub = suscribirComandoEstado(comandoId, _onComandoActualizadoPatched);
    cleanupRef.current = unsub;

    pollingRef.current = setInterval(async () => {
      try {
        const cmd = await getComandoEstado(comandoId);
        _onComandoActualizadoPatched(cmd);
      } catch { /* silent */ }
    }, 3000);

    return () => {
      unsub();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [comandoId]);

  const _limpiarMonitoreo = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const handleCancelScanning = async () => {
    _limpiarMonitoreo();
    if (usuarioCreado) {
      try {
        await cancelarRegistroEdge(usuarioCreado.id);
      } catch { /* best effort */ }
    }
    setStep("form");
  };

  // ============================================
  // Render
  // ============================================

  return (
    <div className="min-h-screen bg-dg-bg overflow-hidden relative">
      {/* Blurred background content */}
      <div className="absolute inset-0 blur-md opacity-40 pointer-events-none">
        <header className="bg-dg-bg border-b border-dg-border px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-dg-accent" />
            <h1 className="text-xl font-bold tracking-tight font-headline">Usuarios</h1>
          </div>
        </header>
        <main className="p-4 space-y-3">
          <div className="cyber-card h-20 w-full" />
          <div className="cyber-card h-20 w-full" />
        </main>
      </div>

      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-40" />

      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-dg-bg rounded-t-2xl border-t border-x border-dg-border p-6 shadow-[0px_-24px_48px_rgba(0,0,0,0.6)] max-h-[92vh] overflow-y-auto"
      >
        <div className="w-12 h-1 bg-dg-border rounded-full mx-auto mb-8 shrink-0" />
        
        {/* ============ FORMULARIO ============ */}
        {step === "form" && (
          <>
            <div className="flex items-center gap-4 mb-6 shrink-0">
              <div className="w-10 h-10 rounded-xl bg-dg-accent/10 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-dg-accent" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight font-headline">Registrar Nuevo Usuario</h2>
            </div>

            <div className="space-y-6 pb-10">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-dg-text-muted px-1">NOMBRE COMPLETO</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Juan Pérez"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(""); }}
                    disabled={isSubmitting}
                    className={`w-full bg-dg-card border ${error ? 'border-dg-error' : 'border-dg-border'} rounded-xl px-4 py-3 text-white placeholder:text-dg-text-muted/50 focus:ring-2 focus:ring-dg-accent/30 outline-none text-sm disabled:opacity-50`}
                  />
                  {error && <p className="text-xs text-dg-error px-1 mt-1">{error}</p>}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-dg-text-muted px-1">NOTAS (OPCIONAL)</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Empleado piso 3, Visitante temporal"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-dg-card border border-dg-border rounded-xl px-4 py-3 text-white placeholder:text-dg-text-muted/50 focus:ring-2 focus:ring-dg-accent/30 outline-none text-sm disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="bg-dg-card border border-dg-border rounded-2xl p-4 flex gap-4">
                <Info className="w-6 h-6 text-dg-accent shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm text-white leading-snug">
                    La persona debe estar frente a la cámara durante el registro. Se capturarán 5 ángulos faciales en aproximadamente 30 segundos.
                  </p>
                  <p className="text-[11px] text-dg-text-muted">
                    Asegúrese de buena iluminación y que el rostro sea claramente visible. El nodo edge debe estar encendido.
                  </p>
                </div>
              </div>

              <div className="space-y-6 pt-2">
                <div className="flex justify-between items-center max-w-sm mx-auto">
                  {ANGULOS.map((a) => (
                    <div key={a.step} className="flex flex-col items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-dg-card border border-dg-border flex items-center justify-center text-xs text-dg-text-muted font-bold">
                        {a.step}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-xs text-dg-text-muted font-medium">Paso 0 de 5</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button 
                  onClick={handleStartRegistration}
                  disabled={isSubmitting}
                  className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-dg-bg border-t-transparent rounded-full animate-spin" />
                      Creando usuario...
                    </>
                  ) : (
                    <>
                      <Video className="w-5 h-5" /> Iniciar Registro
                    </>
                  )}
                </button>
                <button 
                  onClick={() => navigate("/users")}
                  disabled={isSubmitting}
                  className="btn-secondary w-full py-4 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </>
        )}

        {/* ============ ESPERANDO EDGE ============ */}
        {step === "waiting_edge" && (
          <>
            <div className="flex items-center gap-4 mb-6 shrink-0">
              <div className="w-10 h-10 rounded-lg bg-dg-accent/10 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-dg-accent" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight font-headline">Registrar Nuevo Usuario</h2>
                {usuarioCreado && (
                  <p className="text-[10px] text-dg-text-muted font-medium mt-0.5">
                    {usuarioCreado.nombre} · ID: {usuarioCreado.id.substring(0, 8)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-6 pb-10">
              <div className="cyber-card p-8 text-center relative overflow-hidden">
                <div className="mb-4 flex justify-center">
                  <WifiOff className="w-12 h-12 text-dg-warning animate-pulse" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">
                  Esperando respuesta del edge...
                </h3>
                <p className="text-dg-text-muted text-xs mb-4">
                  El comando fue enviado. El pipeline IA lo procesará en los próximos segundos.
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-dg-warning/10 border border-dg-warning/20">
                  <div className="w-2 h-2 rounded-full bg-dg-warning animate-pulse" />
                  <span className="text-[10px] font-bold text-dg-warning uppercase tracking-wider">
                    Polling...
                  </span>
                </div>
              </div>

              <button 
                onClick={handleCancelScanning}
                className="btn-secondary w-full py-4"
              >
                Cancelar
              </button>
            </div>
          </>
        )}

        {/* ============ SCANNING (REAL) ============ */}
        {step === "scanning" && (
          <>
            <div className="flex items-center gap-4 mb-6 shrink-0">
              <div className="w-10 h-10 rounded-lg bg-dg-accent/10 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-dg-accent" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight font-headline">Registrar Nuevo Usuario</h2>
                {usuarioCreado && (
                  <p className="text-[10px] text-dg-text-muted font-medium mt-0.5">
                    {usuarioCreado.nombre} · ID: {usuarioCreado.id.substring(0, 8)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-6 pb-10">
              <div className="flex justify-between items-center relative px-2">
                {/* Progress line background */}
                <div className="absolute top-[18px] -translate-y-1/2 left-8 right-8 h-[2px] bg-dg-border z-0" />
                {/* Progress line filled */}
                <div
                  className="absolute top-[18px] -translate-y-1/2 left-8 h-[2px] bg-dg-accent z-0 transition-all duration-500"
                  style={{ width: `${(anguloActual / (ANGULOS.length)) * (100 - 16)}%` }}
                />
                
                {ANGULOS.map((a, i) => (
                  <div key={a.step}>
                    <StepIndicator
                      step={a.step}
                      label={a.label}
                      completed={i < anguloActual}
                      active={i === anguloActual}
                    />
                  </div>
                ))}
              </div>

              <div className="text-center mt-6 flex flex-col gap-1">
                <p className="text-dg-text-muted text-[10px] uppercase font-bold tracking-widest">
                  Paso {Math.min(anguloActual + 1, ANGULOS.length)} de {ANGULOS.length}
                </p>
                <p className="text-dg-text-muted/50 text-[9px] font-medium">
                  Captura en progreso — datos reales del pipeline IA
                </p>
              </div>

              <div className="cyber-card p-6 text-center mb-8 relative overflow-hidden">
                {activeCameraId && !webrtcFailed ? (
                  <div className="w-full aspect-video bg-black rounded-xl overflow-hidden relative mb-4 border border-dg-border shadow-[0_0_20px_rgba(163,255,0,0.1)]">
                    <WebRTCPlayer 
                      cameraId={activeCameraId} 
                      edgeOnline={true} 
                      onFallback={() => setWebrtcFailed(true)} 
                    />
                  </div>
                ) : (
                  <div className="mb-4 flex justify-center">
                    <RotateCw className="w-12 h-12 text-dg-accent animate-spin-slow" />
                  </div>
                )}
                
                <h3 className="text-white font-bold text-lg mb-1">
                  {anguloActual < ANGULOS.length ? ANGULOS[anguloActual]?.instruccion : "Finalizando..."}
                </h3>
                <p className="text-dg-text-muted text-xs mb-4">
                  Mantenga el rostro visible para la cámara
                </p>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-dg-accent/10 border border-dg-accent/20">
                  <Hourglass className="w-3.5 h-3.5 text-dg-accent animate-pulse" />
                  <span className="text-[10px] font-bold text-dg-accent uppercase tracking-wider">
                    Capturando ángulo {anguloActual < ANGULOS.length ? ANGULOS[anguloActual]?.label : "..."}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <button 
                  disabled
                  className="btn-primary w-full py-4 flex items-center justify-center gap-2 opacity-80"
                >
                  <div className="w-5 h-5 border-2 border-dg-bg border-t-transparent rounded-full animate-spin" />
                  Capturando embeddings reales...
                </button>
                <button 
                  onClick={handleCancelScanning}
                  className="btn-secondary w-full py-4"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </>
        )}

        {/* ============ ERROR ============ */}
        {step === "error" && (
          <div className="px-2 pb-10 space-y-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-dg-error/20 blur-xl rounded-full" />
                <AlertTriangle className="w-16 h-16 text-dg-error relative z-10" />
              </div>
              <div>
                <h2 className="text-[20px] font-bold text-white leading-tight font-headline">Error en el Registro</h2>
                <p className="text-dg-text-muted text-sm mt-1">{error}</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { setStep("form"); setError(""); }}
                className="btn-primary w-full h-14 flex items-center justify-center gap-2"
              >
                Intentar de Nuevo
              </button>
              <button 
                onClick={() => navigate("/users")}
                className="btn-secondary w-full h-14"
              >
                Volver a Usuarios
              </button>
            </div>
          </div>
        )}

        {/* ============ ÉXITO ============ */}
        {step === "success" && (
          <div className="px-2 pb-10 space-y-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-dg-success/20 blur-xl rounded-full" />
                <CheckCircle className="w-16 h-16 text-dg-success relative z-10 fill-dg-success/10" />
              </div>
              <div>
                <h2 className="text-[20px] font-bold text-white leading-tight font-headline">¡Registro Exitoso!</h2>
                <p className="text-dg-text-muted text-sm mt-1">Usuario registrado con embeddings reales del pipeline IA</p>
              </div>
            </div>

            <div className="bg-dg-card p-4 rounded-2xl flex items-center justify-between border border-dg-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-dg-accent/10 flex items-center justify-center border border-dg-accent/20">
                  <span className="text-dg-accent font-bold text-lg">
                    {(usuarioCreado?.nombre ?? name).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-white">{usuarioCreado?.nombre ?? name}</p>
                  <p className="text-xs text-dg-text-muted">
                    ID: #{usuarioCreado?.id.substring(0, 8) ?? "------"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-dg-success/20 px-3 py-1 rounded-full border border-dg-success/30">
                <span className="w-2 h-2 rounded-full bg-dg-success" />
                <span className="text-[10px] font-bold text-dg-success uppercase tracking-wider">Activo</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative flex justify-between items-center px-2">
                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-dg-accent -translate-y-1/2 z-0" />
                {ANGULOS.map((a) => (
                  <div key={a.step} className="relative z-10 flex flex-col items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-dg-accent flex items-center justify-center shadow-[0_0_12px_rgba(163,255,0,0.4)]">
                      <Check className="w-4 h-4 text-dg-bg font-bold" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-dg-text-muted text-[10px] font-medium tracking-wide">
                {usuarioCreado?.num_angulos ?? 5} de 5 ángulos capturados
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-dg-card p-4 rounded-xl border border-dg-border flex flex-col items-center justify-center">
                <span className="text-dg-accent text-2xl font-bold font-headline">{usuarioCreado?.num_angulos ?? 5}</span>
                <span className="text-dg-text-muted text-[10px] uppercase tracking-widest font-semibold">Ángulos</span>
              </div>
              <div className="bg-dg-card p-4 rounded-xl border border-dg-border flex flex-col items-center justify-center">
                <span className="text-white text-2xl font-bold font-headline">Real</span>
                <span className="text-dg-text-muted text-[10px] uppercase tracking-widest font-semibold">Pipeline IA</span>
              </div>
            </div>

            <button 
              onClick={() => navigate("/users")}
              className="btn-primary w-full h-14 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Volver a Usuarios</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ============================================
// Sub-componente
// ============================================

function StepIndicator({ step, label, completed, active }: { step: number, label: string, completed?: boolean, active?: boolean }) {
  return (
    <div className="flex flex-col items-center relative z-10 gap-2">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
        completed ? "bg-dg-accent text-dg-bg" : 
        active ? "bg-dg-bg border-2 border-dg-accent text-dg-accent shadow-[0_0_15px_rgba(163,255,0,0.2)]" : 
        "bg-dg-card border border-dg-border text-dg-text-muted"
      }`}>
        {completed ? <Check className="w-5 h-5" /> : <span className="text-sm font-bold">{step}</span>}
      </div>
      <span className={`text-[8px] font-bold uppercase tracking-tighter ${active || completed ? "text-dg-accent" : "text-dg-text-muted/60"}`}>
        {label}
      </span>
    </div>
  );
}
