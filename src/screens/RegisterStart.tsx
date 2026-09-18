import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  Info,
  Video,
  Users,
  Check,
  CheckCircle,
  ArrowLeft,
  AlertTriangle,
  ScanFace,
  ShieldCheck,
  FileCheck2,
} from "lucide-react";
import { motion } from "motion/react";
import WebRTCPlayer from "../components/WebRTCPlayer";
import BiometricFrame, { type EstadoMarco, type Pose } from "../components/BiometricFrame";
import { leerCalidad, consejoPrioritario, type CalidadCaptura } from "../lib/calidadCaptura";
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
  type CameraId,
} from "../lib/supabase";

// ============================================
// Configuración de ángulos de captura
// ============================================

const ANGULOS: { step: number; label: string; pose: Pose; instruccion: string }[] = [
  { step: 1, label: "Frontal", pose: "frontal", instruccion: "Mire directamente a la cámara" },
  { step: 2, label: "Izquierda", pose: "izquierda", instruccion: "Gire la cabeza a su izquierda" },
  { step: 3, label: "Derecha", pose: "derecha", instruccion: "Gire la cabeza a su derecha" },
  { step: 4, label: "Arriba", pose: "arriba", instruccion: "Levante la barbilla" },
  { step: 5, label: "Abajo", pose: "abajo", instruccion: "Baje la barbilla" },
];

/**
 * A partir de aqui damos por perdida la espera del terminal. Veinte segundos
 * es de sobra para un latido de un edge sano; antes la pantalla se quedaba en
 * "Polling..." indefinidamente, sin reintento ni diagnostico.
 */
const ESPERA_MAX_MS = 20_000;

/** Vibracion breve, si el dispositivo la soporta. Nunca debe romper nada. */
function vibrar(patron: number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(patron);
    }
  } catch { /* el navegador puede denegarlo sin motivo: es decorativo */ }
}

export default function RegisterStart() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "consent" | "waiting_edge" | "scanning" | "success" | "error">("form");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);

  // Scanning state — driven by real edge progress
  const [anguloActual, setAnguloActual] = useState(0);

  // Resultado
  const [usuarioCreado, setUsuarioCreado] = useState<Usuario | null>(null);
  const [comandoId, setComandoId] = useState<string | null>(null);

  // WebRTC state
  const [activeCameraId, setActiveCameraId] = useState<CameraId | null>(null);
  const [webrtcFailed, setWebrtcFailed] = useState(false);

  // Calidad de captura publicada por el edge. Null mientras no la publique:
  // ver el contrato en src/lib/calidadCaptura.ts.
  const [calidad, setCalidad] = useState<CalidadCaptura | null>(null);
  // El terminal no ha contestado dentro de ESPERA_MAX_MS.
  const [esperaAgotada, setEsperaAgotada] = useState(false);

  // Angulo que el edge esta capturando ahora mismo. `anguloActual` es el
  // numero de angulos ya completados que publica el comando, asi que ese
  // mismo indice apunta al siguiente por capturar.
  const indiceAngulo = Math.min(anguloActual, ANGULOS.length - 1);
  const anguloEnCurso = ANGULOS[indiceAngulo];

  // Un consejo de calidad urgente manda sobre la instruccion de pose: no
  // sirve de nada pedir que gire la cara si el sistema no le ve por la luz.
  const consejo = consejoPrioritario(calidad);
  const instruccionVisible = consejo ?? anguloEnCurso.instruccion;

  // Estado del marco. Sin datos de calidad nos quedamos en "capturando",
  // que es lo unico que sabemos con certeza.
  const estadoMarco: EstadoMarco = webrtcFailed
    ? "esperando"
    : consejo
      ? "colocando"
      : "capturando";

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

  // Paso 1: Validar formulario y avanzar al consentimiento
  const handleGoToConsent = async () => {
    if (!name.trim()) {
      setError("El nombre completo es obligatorio");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      // Pre-validaciones antes de mostrar consentimiento
      const estado = await getEstadoSistema();
      if (!isEdgeOnline(estado.ultimo_heartbeat)) {
        setError("El terminal de acceso está apagado. Enciéndalo antes de registrar a una persona.");
        setIsSubmitting(false);
        return;
      }

      const camara = estado.camaras?.find(c => c.activa) || estado.camaras?.[0];
      if (camara) {
        setActiveCameraId(camara.camera_id as CameraId);
      }

      const usuariosExistentes = await getUsuarios();
      const duplicado = usuariosExistentes.find(
        (u) => u.nombre.toLowerCase().trim() === name.trim().toLowerCase()
      );
      if (duplicado) {
        setError(`Ya existe un usuario registrado con el nombre "${duplicado.nombre}".`);
        setIsSubmitting(false);
        return;
      }

      // Todo validado — pasar al consentimiento
      setConsentChecked(false);
      setStep("consent");
    } catch (err: any) {
      console.error("Error validando:", err);
      setError(err.message ?? "Error de validación. Intente de nuevo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Paso 2: Aceptar consentimiento y crear usuario + enviar comando
  const handleAcceptConsent = async () => {
    if (!consentChecked) return;

    setIsSubmitting(true);
    setWebrtcFailed(false);

    try {
      // 1. Crear usuario en Supabase con registro de consentimiento
      const nuevoUsuario = await crearUsuario(name.trim(), notes.trim());
      setUsuarioCreado(nuevoUsuario);

      // 2. Insertar comando INICIAR_REGISTRO
      const comando = await insertarComandoRegistro(nuevoUsuario.id, name.trim());
      setComandoId(comando.id);

      // 3. Pasar a "esperando edge"
      setStep("waiting_edge");
      setAnguloActual(0);
      setCalidad(null);
      setEsperaAgotada(false);

      // 4. El monitoreo (Realtime + polling) lo arranca el efecto de
      //    `comandoId`, en cuanto React aplica el estado de arriba.

    } catch (err: any) {
      console.error("Error iniciando registro:", err);
      setError(err.message ?? "Error al crear el usuario. Intente de nuevo.");
      setStep("form");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================
  // Monitoreo del comando (Realtime + polling)
  // ============================================

  /**
   * Unico punto donde se traduce el estado del comando del edge a la
   * pantalla. Antes habia dos copias de esta funcion (una original y una
   * "parcheada" que la sustituia) y un `stepRef` que se asignaba sin que
   * nadie lo leyera nunca.
   */
  const _onComandoActualizado = (comando: ComandoEdge) => {
    setAnguloActual((previo) => {
      // Un angulo mas capturado: confirmacion hapatica, que en movil sustituye
      // a mirar la pantalla justo cuando la persona tiene la cara girada.
      if (comando.progreso > previo) vibrar([30]);
      return comando.progreso;
    });
    setCalidad(leerCalidad(comando.resultado));

    if (comando.estado === "en_progreso") {
      setStep("scanning");
    }
    if (comando.estado === "completado") {
      _limpiarMonitoreo();
      vibrar([30, 40, 30]);
      setUsuarioCreado((prev) => prev ? { ...prev, num_angulos: comando.progreso } : null);
      setStep("success");
    }
    if (comando.estado === "error") {
      _limpiarMonitoreo();
      vibrar([60, 40, 60]);
      const msg = comando.resultado?.error ?? "El terminal no pudo completar la captura.";
      setError(msg);
      setStep("error");
    }
    if (comando.estado === "cancelado") {
      _limpiarMonitoreo();
      setStep("form");
    }
  };

  useEffect(() => {
    if (!comandoId) return;
    // Re-subscribe with patched handler
    cleanupRef.current?.();
    if (pollingRef.current) clearInterval(pollingRef.current);

    const unsub = suscribirComandoEstado(comandoId, _onComandoActualizado);
    cleanupRef.current = unsub;

    pollingRef.current = setInterval(async () => {
      try {
        const cmd = await getComandoEstado(comandoId);
        _onComandoActualizado(cmd);
      } catch { /* silent */ }
    }, 3000);

    return () => {
      unsub();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [comandoId]);

  // Corta la espera del terminal a los ESPERA_MAX_MS. Antes, si el edge no
  // contestaba nunca, la pantalla se quedaba en "Polling..." para siempre y
  // la unica salida era cancelar.
  useEffect(() => {
    if (step !== "waiting_edge") return;
    setEsperaAgotada(false);
    const t = setTimeout(() => setEsperaAgotada(true), ESPERA_MAX_MS);
    return () => clearTimeout(t);
  }, [step]);

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
            <Users className="w-6 h-6 text-dg-text-secondary" aria-hidden="true" />
            <h1 className="text-xl font-bold tracking-tight headline">Usuarios</h1>
          </div>
        </header>
        <main className="p-4 space-y-3 max-w-7xl mx-auto w-full">
          <div className="cyber-card h-20 w-full" />
          <div className="cyber-card h-20 w-full" />
        </main>
      </div>

      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-40" />

      {/* Hoja inferior en movil; en escritorio se centra como tarjeta en
          lugar de estirarse de borde a borde de la pantalla. */}
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-dg-bg rounded-t-dg-lg border-t border-x border-dg-border p-6 shadow-[0px_-24px_48px_rgba(0,0,0,0.6)] max-h-[92vh] overflow-y-auto md:max-w-2xl md:mx-auto md:bottom-8 md:rounded-dg-lg md:border"
      >
        <div className="w-12 h-1 bg-dg-border rounded-full mx-auto mb-8 shrink-0" />
        
        {/* ============ FORMULARIO ============ */}
        {step === "form" && (
          <>
            <div className="flex items-center gap-4 mb-6 shrink-0">
              <div className="w-10 h-10 rounded-dg bg-dg-action/10 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-dg-action-text" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-bold text-dg-text tracking-tight headline">Registrar Nuevo Usuario</h2>
            </div>

            <div className="space-y-6 pb-10">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="registro-nombre" className="block text-sm font-medium text-dg-text-secondary px-1">Nombre completo</label>
                  <input 
                    id="registro-nombre"
                    type="text" 
                    autoComplete="name"
                    placeholder="Ej: Juan Pérez"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(""); }}
                    disabled={isSubmitting}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? "registro-nombre-error" : undefined}
                    className={`w-full bg-dg-card border ${error ? 'border-dg-error' : 'border-dg-border'} rounded-dg px-4 py-3 text-dg-text placeholder:text-dg-text-muted focus:border-dg-focus transition-colors text-base disabled:opacity-50`}
                  />
                  {error && <p id="registro-nombre-error" role="alert" className="text-xs text-dg-error px-1 mt-1">{error}</p>}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="registro-notas" className="block text-sm font-medium text-dg-text-secondary px-1">Notas <span className="text-dg-text-muted font-normal">(opcional)</span></label>
                  <input 
                    id="registro-notas"
                    type="text" 
                    placeholder="Ej: Empleado piso 3, Visitante temporal"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full bg-dg-card border border-dg-border rounded-dg px-4 py-3 text-dg-text placeholder:text-dg-text-muted focus:border-dg-focus transition-colors text-base disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="bg-dg-card border border-dg-border rounded-dg-lg p-4 flex gap-4">
                <Info className="w-6 h-6 text-dg-info shrink-0" aria-hidden="true" />
                <div className="space-y-2">
                  <p className="text-sm text-dg-text leading-snug">
                    La persona debe estar frente a la cámara durante el registro. Se capturarán 5 ángulos faciales en aproximadamente 30 segundos.
                  </p>
                  <p className="text-2xs text-dg-text-muted">
                    Asegúrese de que hay buena luz y de que el rostro se ve con claridad. El terminal de acceso debe estar encendido.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <div className="flex gap-2 w-full max-w-xs mx-auto">
                  {ANGULOS.map((a) => (
                    <div key={a.step} className="h-1 flex-1 rounded-full bg-dg-border/40" />
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-2xs text-dg-text-muted uppercase font-bold">5 Fases de Captura</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button 
                  onClick={handleGoToConsent}
                  disabled={isSubmitting}
                  className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                      Comprobando…
                    </>
                  ) : (
                    <>
                      <Video className="w-5 h-5" /> Continuar
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

        {/* ============ CONSENTIMIENTO ============ */}
        {step === "consent" && (
          <>
            <div className="flex items-center gap-4 mb-6 shrink-0">
              <div className="w-10 h-10 rounded-dg bg-dg-action/10 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-dg-action-text" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-dg-text tracking-tight headline">Autorización Biométrica</h2>
                <p className="text-2xs text-dg-text-muted font-medium mt-0.5">
                  {name.trim()} · Paso obligatorio
                </p>
              </div>
            </div>

            <div className="space-y-5 pb-10">
              {/* Texto legal */}
              <div className="bg-dg-card border border-dg-border rounded-dg-lg p-5 space-y-4">
                <div className="flex items-center gap-3 mb-1">
                  <FileCheck2 className="w-5 h-5 text-dg-action-text shrink-0" aria-hidden="true" />
                  <h3 className="text-sm font-bold text-dg-text">Consentimiento para Tratamiento de Datos Biométricos</h3>
                </div>

                <div className="text-xs text-dg-text-muted leading-relaxed space-y-3">
                  <p>
                    Autorizo de manera <span className="text-dg-text font-medium">libre, voluntaria, previa, expresa e informada</span> la 
                    captura, procesamiento y almacenamiento de mi geometría facial con el fin exclusivo de 
                    habilitar el control de acceso biométrico mediante el sistema <span className="text-dg-text font-medium">DepthGuard</span>.
                  </p>

                  <p className="font-semibold text-dg-text-muted/90">Se me ha informado que:</p>

                  <ul className="space-y-2 pl-1">
                    <li className="flex gap-2">
                      <span className="text-dg-action-text font-bold">1.</span>
                      <span><span className="text-dg-text font-medium">Dato sensible:</span> La biometría facial constituye un dato personal sensible conforme a la Ley 1581 de 2012. Su entrega es de carácter estrictamente voluntario.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-dg-action-text font-bold">2.</span>
                      <span><span className="text-dg-text font-medium">Finalidad exclusiva:</span> Mis datos biométricos serán utilizados únicamente para la verificación de identidad en puntos de acceso controlados por este sistema.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-dg-action-text font-bold">3.</span>
                      <span><span className="text-dg-text font-medium">Seguridad:</span> Mi rostro no será almacenado como fotografía. Será transformado de manera irreversible en vectores matemáticos (embeddings), garantizando que no pueda reconstruirse mi imagen facial a partir de los datos almacenados.</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-dg-action-text font-bold">4.</span>
                      <span><span className="text-dg-text font-medium">Derechos:</span> Como titular, tengo derecho a conocer, actualizar, rectificar y solicitar la supresión de mis datos biométricos en cualquier momento ante el responsable del tratamiento.</span>
                    </li>
                  </ul>

                  <p className="pt-1 border-t border-dg-border/50">
                    Al aceptar y participar activamente en el escaneo facial (girando mi rostro en las direcciones solicitadas), 
                    <span className="text-dg-text font-medium"> reafirmo de manera inequívoca mi voluntad y consentimiento</span>.
                  </p>
                </div>
              </div>

              {/* Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group p-3 rounded-dg border border-dg-border/50 hover:border-dg-action-text/40 transition-colors">
                <div className="relative mt-0.5 shrink-0">
                  <input 
                    type="checkbox" 
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded-dg-sm border-2 flex items-center justify-center transition-all ${
                    consentChecked 
                      ? 'bg-dg-action border-dg-action' 
                      : 'border-dg-border group-hover:border-dg-text-muted'
                  }`}>
                    {consentChecked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                  </div>
                </div>
                <span className="text-xs text-dg-text-muted leading-relaxed">
                  He leído y comprendido la información anterior. 
                  <span className="text-dg-text font-medium"> Otorgo mi consentimiento expreso e informado</span> para 
                  el tratamiento de mis datos biométricos faciales.
                </span>
              </label>

              {/* Botones */}
              <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={handleAcceptConsent}
                  disabled={!consentChecked || isSubmitting}
                  className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                      Iniciando…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" aria-hidden="true" /> Aceptar y comenzar
                    </>
                  )}
                </button>
                <button 
                  onClick={() => { setStep("form"); setConsentChecked(false); }}
                  disabled={isSubmitting}
                  className="btn-secondary w-full py-4 disabled:opacity-50"
                >
                  Volver
                </button>
              </div>
            </div>
          </>
        )}

        {/* ============ ESPERANDO EDGE ============ */}
        {step === "waiting_edge" && (
          <>
            <div className="flex items-center gap-4 mb-6 shrink-0">
              <div className="w-10 h-10 rounded-dg bg-dg-action/10 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-dg-action-text" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-dg-text tracking-tight headline">Registrar Nuevo Usuario</h2>
                {usuarioCreado && (
                  <p className="text-2xs text-dg-text-muted font-medium mt-0.5">
                    {usuarioCreado.nombre} · ID: {usuarioCreado.id.substring(0, 8)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-6 pb-10">
              {/*
                Espera del terminal.

                Antes esta pantalla decia "Esperando respuesta del edge...",
                "El pipeline IA lo procesara en los proximos segundos" y
                mostraba un distintivo con la palabra "Polling...", encabezado
                por un icono de SIN CONEXION en ambar: el camino feliz se
                anunciaba con la senal visual de una averia.
              */}
              {esperaAgotada ? (
                <div className="cyber-card p-6 text-center" role="alert">
                  <div className="mb-4 flex justify-center">
                    <AlertTriangle className="h-10 w-10 text-dg-warning" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-dg-text">
                    El terminal no responde
                  </h3>
                  <p className="mx-auto mb-5 max-w-sm text-sm text-dg-text-secondary">
                    Se envió la orden de registro pero el terminal de acceso no ha
                    contestado. Compruebe que está encendido y conectado a la red.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => setEsperaAgotada(false)}
                      className="btn-primary flex-1"
                    >
                      Seguir esperando
                    </button>
                    <button
                      onClick={() => navigate("/settings")}
                      className="btn-secondary flex-1"
                    >
                      Ver estado del sistema
                    </button>
                  </div>
                </div>
              ) : (
                <div className="cyber-card p-8 text-center" role="status">
                  <div className="mb-4 flex justify-center">
                    <ScanFace className="h-12 w-12 text-dg-info" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold text-dg-text">
                    Preparando la cámara
                  </h3>
                  <p className="mx-auto max-w-sm text-sm text-dg-text-secondary">
                    Conectando con el terminal de acceso. Suele tardar unos segundos.
                  </p>
                  <div
                    aria-hidden="true"
                    className="mx-auto mt-5 h-1 w-40 overflow-hidden rounded-full bg-dg-canvas"
                  >
                    <div className="h-full w-1/3 rounded-full bg-dg-info animate-pulse" />
                  </div>
                </div>
              )}

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
              <div className="w-10 h-10 rounded-dg bg-dg-action/10 flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-dg-action-text" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-dg-text tracking-tight headline">Escaneando el rostro</h2>
                {usuarioCreado && (
                  <p className="text-2xs text-dg-text-muted font-medium mt-0.5">
                    {usuarioCreado.nombre} · ID: {usuarioCreado.id.substring(0, 8)}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-5 pb-10">
              {/*
                Todo el encuadre, el progreso y la guia viven ahora en
                BiometricFrame. Antes esto era un <video> desnudo sobre negro,
                sin ovalo, sin mascara y sin una sola indicacion de donde
                debia colocarse la persona.
              */}
              <BiometricFrame
                estado={estadoMarco}
                instruccion={instruccionVisible}
                pose={anguloEnCurso.pose}
                progreso={anguloActual / ANGULOS.length}
                angulosHechos={anguloActual}
                angulosTotal={ANGULOS.length}
                calidad={calidad}
              >
                {activeCameraId && !webrtcFailed ? (
                  <WebRTCPlayer
                    cameraId={activeCameraId}
                    edgeOnline={true}
                    onFallback={() => setWebrtcFailed(true)}
                    minimal
                    variante="bare"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-dg-canvas" role="status">
                    <span className="max-w-[14rem] text-center text-sm text-dg-text-secondary">
                      Sin vídeo en directo. La captura continúa en el terminal.
                    </span>
                  </div>
                )}
              </BiometricFrame>

              {/* Botón cancelar */}
              <button 
                onClick={handleCancelScanning}
                className="btn-secondary w-full py-4"
              >
                Cancelar Registro
              </button>
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
                <h2 className="text-xl font-bold text-dg-text leading-tight headline">Error en el Registro</h2>
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
                <h2 className="text-xl font-bold text-dg-text leading-tight headline">¡Registro Exitoso!</h2>
                <p className="text-dg-text-secondary text-sm mt-1">
                  {(usuarioCreado?.nombre ?? name).split(" ")[0]} ya puede acceder.
                </p>
              </div>
            </div>

            <div className="bg-dg-card p-4 rounded-dg-lg flex items-center justify-between border border-dg-border">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-dg-input border border-dg-border flex items-center justify-center">
                  <span className="text-dg-text-secondary font-bold text-lg">
                    {(usuarioCreado?.nombre ?? name).split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U'}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-dg-text">{usuarioCreado?.nombre ?? name}</p>
                  <p className="text-xs text-dg-text-muted">
                    ID: #{usuarioCreado?.id.substring(0, 8) ?? "------"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-dg-success/20 px-3 py-1 rounded-full border border-dg-success/30">
                <span className="w-2 h-2 rounded-full bg-dg-success" />
                <span className="text-2xs font-bold text-dg-success uppercase">Activo</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative flex justify-between items-center px-2">
                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-dg-success -translate-y-1/2 z-0" />
                {ANGULOS.map((a) => (
                  <div key={a.step} className="relative z-10 flex flex-col items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-dg-success flex items-center justify-center">
                      <Check className="w-4 h-4 text-dg-bg" strokeWidth={3} aria-hidden="true" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-dg-text-muted text-2xs font-medium tracking-wide">
                {usuarioCreado?.num_angulos ?? 5} de 5 ángulos capturados
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-dg-card p-4 rounded-dg border border-dg-border flex flex-col items-center justify-center">
                <span className="text-dg-text text-2xl font-bold headline tabular">{usuarioCreado?.num_angulos ?? 5}</span>
                <span className="text-dg-text-muted text-2xs uppercase font-semibold">Ángulos</span>
              </div>
              <div className="bg-dg-card p-4 rounded-dg border border-dg-border flex flex-col items-center justify-center text-center">
                <ShieldCheck className="h-6 w-6 text-dg-success" aria-hidden="true" />
                <span className="mt-1 text-dg-text-muted text-2xs uppercase font-semibold">Plantilla cifrada</span>
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
