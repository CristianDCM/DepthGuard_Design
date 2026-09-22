import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  Info,
  Video,
  Check,
  CheckCircle,
  ArrowLeft,
  AlertTriangle,
  ScanFace,
  ShieldCheck,
  FileCheck2,
} from "lucide-react";
import WebRTCPlayer from "../components/WebRTCPlayer";
import BiometricFrame, { type EstadoMarco, type Pose } from "../components/BiometricFrame";
import { leerCalidad, consejoPrioritario, type CalidadCaptura } from "../lib/calidadCaptura";
import { traducirError, type ErrorUi } from "../lib/errores";
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
  /** Error de validacion del formulario: cabe en una linea bajo el campo. */
  const [error, setError] = useState("");
  /** Error que ocupa la pantalla: lleva causa, accion y codigo de soporte. */
  const [errorUi, setErrorUi] = useState<ErrorUi | null>(null);
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
  // `progreso` es `integer DEFAULT 0` pero admite nulo, y si el edge manda el
  // campo ausente llega `undefined`: Math.min(undefined, 4) da NaN,
  // ANGULOS[NaN] es undefined y leer .instruccion tumbaba la pantalla entera.
  const anguloSeguro = Number.isFinite(anguloActual) ? Math.trunc(anguloActual) : 0;
  const indiceAngulo = Math.min(Math.max(anguloSeguro, 0), ANGULOS.length - 1);
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
    } catch (err) {
      console.error("Error validando:", err);
      // Antes aqui salia el texto crudo del error, que podia ser
      // "Failed to fetch" o "JWT expired": ninguno dice que hacer.
      setErrorUi(traducirError(err, { contexto: "registro" }));
      setStep("error");
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

    } catch (err) {
      console.error("Error iniciando registro:", err);
      setErrorUi(traducirError(err, { contexto: "registro" }));
      setStep("error");
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
      const progreso = Number.isFinite(comando.progreso) ? comando.progreso : previo;
      // Un angulo mas capturado: confirmacion hapatica, que en movil sustituye
      // a mirar la pantalla justo cuando la persona tiene la cara girada.
      if (progreso > previo) vibrar([30]);
      return progreso;
    });
    setCalidad(leerCalidad(comando.resultado));

    if (comando.estado === "en_progreso") {
      setStep("scanning");
    }
    if (comando.estado === "completado") {
      _limpiarMonitoreo();
      vibrar([30, 40, 30]);
      setUsuarioCreado((prev) => prev ? { ...prev, num_angulos: comando.progreso ?? prev.num_angulos } : null);
      setStep("success");
    }
    if (comando.estado === "error") {
      _limpiarMonitoreo();
      vibrar([60, 40, 60]);
      // El edge manda su propio texto. Se conserva como detalle tecnico,
      // pero el titular y la accion los pone la aplicacion.
      const detalle = typeof comando.resultado?.error === "string" ? comando.resultado.error : "";
      setErrorUi({
        ...traducirError(detalle, { contexto: "registro" }),
        titulo: "No se pudo completar la captura",
        cuerpo: detalle || "El terminal interrumpió el escaneo. Vuelva a intentarlo con la persona frente a la cámara.",
      });
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
    <div className="mini min-h-screen bg-dg-bg overflow-hidden relative">
      {/*
        El unico encabezado de la pantalla estaba en la cabecera falsa del
        decorado, y decia "Usuarios". Al retirarlo la pagina se quedaba sin
        <h1>: este dice de verdad donde esta quien entra, como en el resto
        del panel.
      */}
      <h1 className="sr-only">Registrar nuevo usuario</h1>

      {/*
        Velo plano. Antes debajo habia una cabecera y dos tarjetas falsas,
        desenfocadas, imitando la pantalla de Usuarios: decorado que ni es
        contenido real ni se puede tocar, y que el desenfoque del velo
        volvia a tapar. Sin el, el lienzo se ve como lo que es.
      */}
      <div className="absolute inset-0 z-40 bg-dg-canvas/80" />

      {/* Hoja inferior en movil; en escritorio se centra como tarjeta en
          lugar de estirarse de borde a borde de la pantalla. */}
      <div
        // overscroll-contain: sin esto, un scroll de mas dentro de la hoja
        // propaga al documento y dispara el pull-to-refresh del navegador,
        // que recarga la pagina EN MITAD del escaneo facial y pierde el
        // registro.
        style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}
        className="fixed bottom-0 left-0 right-0 z-50 max-h-[92vh] overflow-y-auto border-t border-x border-dg-border bg-dg-bg p-6 md:mx-auto md:bottom-8 md:max-w-2xl md:border"
      >
        <div className="mx-auto mb-8 h-1 w-12 shrink-0 bg-dg-border" />
        
        {/* ============ FORMULARIO ============ */}
        {step === "form" && (
          <>
            <div className="flex items-center gap-4 mb-6 shrink-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-dg-border">
                <UserPlus className="w-6 h-6 text-dg-action-text" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-bold uppercase tracking-[0.8px] text-dg-text">Registrar Nuevo Usuario</h2>
            </div>

            <div className="space-y-6 pb-10">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="registro-nombre" className="block px-1 text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Nombre completo</label>
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
                    className={`w-full border bg-transparent ${error ? 'border-dg-error' : 'border-dg-border'} px-4 py-3 text-base text-dg-text placeholder:text-dg-text-muted focus:border-dg-text disabled:opacity-50`}
                  />
                  {error && <p id="registro-nombre-error" role="alert" className="text-xs text-dg-error px-1 mt-1">{error}</p>}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="registro-notas" className="block px-1 text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Notas <span className="font-normal">(opcional)</span></label>
                  <input 
                    id="registro-notas"
                    type="text" 
                    placeholder="Ej: Empleado piso 3, Visitante temporal"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full border border-dg-border bg-transparent px-4 py-3 text-base text-dg-text placeholder:text-dg-text-muted focus:border-dg-text disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="mini-card flex gap-4 p-4">
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
                    <div key={a.step} className="h-1 flex-1 bg-dg-border" />
                  ))}
                </div>
                <div className="text-center">
                  <p className="text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">5 Fases de Captura</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-4">
                <button 
                  onClick={handleGoToConsent}
                  disabled={isSubmitting}
                  className="mini-btn mini-btn-strong flex w-full items-center justify-center gap-2 py-4 text-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    "Comprobando"
                  ) : (
                    <>
                      <Video className="h-5 w-5" aria-hidden="true" /> Continuar
                    </>
                  )}
                </button>
                <button 
                  onClick={() => navigate("/users")}
                  disabled={isSubmitting}
                  className="mini-btn w-full py-4 text-sm disabled:opacity-50"
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-dg-border">
                <ShieldCheck className="w-6 h-6 text-dg-action-text" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold uppercase tracking-[0.8px] text-dg-text">Autorización Biométrica</h2>
                <p className="text-2xs text-dg-text-muted font-medium mt-0.5">
                  {name.trim()} · Paso obligatorio
                </p>
              </div>
            </div>

            <div className="space-y-5 pb-10">
              {/* Texto legal */}
              <div className="mini-card space-y-4 p-5">
                <div className="flex items-center gap-3 mb-1">
                  <FileCheck2 className="w-5 h-5 text-dg-action-text shrink-0" aria-hidden="true" />
                  <h3 className="text-sm font-bold uppercase tracking-[0.8px] text-dg-text">Consentimiento para Tratamiento de Datos Biométricos</h3>
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
              <label className="group flex cursor-pointer items-start gap-3 border border-dg-border p-3 hover:bg-white/5">
                <div className="relative mt-0.5 shrink-0">
                  <input 
                    type="checkbox" 
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="sr-only peer"
                  />
                  {/*
                    El <input> real esta oculto y la casilla que se ve es un
                    <div>, asi que el anillo de foco del navegador se dibujaba
                    sobre un elemento recortado a 1px: invisible. Con `peer`
                    lo hereda la casilla dibujada, que es donde hay que verlo
                    (WCAG 2.4.7). Esto faltaba desde antes.
                  */}
                  <div className={`flex h-5 w-5 items-center justify-center border peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-dg-focus ${
                    consentChecked
                      ? 'border-dg-text bg-dg-text'
                      : 'border-dg-border group-hover:border-dg-text-muted'
                  }`}>
                    {consentChecked && <Check className="h-3.5 w-3.5 text-dg-bg" strokeWidth={3} aria-hidden="true" />}
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
                  className="mini-btn mini-btn-strong flex w-full items-center justify-center gap-2 py-4 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSubmitting ? (
                    "Iniciando"
                  ) : (
                    <>
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" /> Aceptar y comenzar
                    </>
                  )}
                </button>
                <button 
                  onClick={() => { setStep("form"); setConsentChecked(false); }}
                  disabled={isSubmitting}
                  className="mini-btn w-full py-4 text-sm disabled:opacity-50"
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-dg-border">
                <UserPlus className="w-6 h-6 text-dg-action-text" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold uppercase tracking-[0.8px] text-dg-text">Registrar Nuevo Usuario</h2>
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
                <div className="mini-card p-6 text-center" role="alert">
                  <div className="mb-4 flex justify-center">
                    <AlertTriangle className="h-10 w-10 text-dg-warning" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold uppercase tracking-[0.8px] text-dg-text">
                    El terminal no responde
                  </h3>
                  <p className="mx-auto mb-5 max-w-sm text-sm text-dg-text-secondary">
                    Se envió la orden de registro pero el terminal de acceso no ha
                    contestado. Compruebe que está encendido y conectado a la red.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => setEsperaAgotada(false)}
                      className="mini-btn mini-btn-strong flex-1 py-3 text-sm"
                    >
                      Seguir esperando
                    </button>
                    <button
                      onClick={() => navigate("/settings")}
                      className="mini-btn flex-1 py-3 text-sm"
                    >
                      Ver estado del sistema
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mini-card p-8 text-center" role="status">
                  <div className="mb-4 flex justify-center">
                    <ScanFace className="h-12 w-12 text-dg-info" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold uppercase tracking-[0.8px] text-dg-text">
                    Preparando la cámara
                  </h3>
                  <p className="mx-auto max-w-sm text-sm text-dg-text-secondary">
                    Conectando con el terminal de acceso. Suele tardar unos segundos.
                  </p>
                  {/* Linea entera y quieta: la anterior latia en bucle. */}
                  <div aria-hidden="true" className="mx-auto mt-5 h-1 w-40 bg-dg-info" />
                </div>
              )}

              <button 
                onClick={handleCancelScanning}
                className="mini-btn w-full py-4 text-sm"
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-dg-border">
                <UserPlus className="w-6 h-6 text-dg-action-text" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold uppercase tracking-[0.8px] text-dg-text">Escaneando el rostro</h2>
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
                progreso={anguloSeguro / ANGULOS.length}
                angulosHechos={anguloSeguro}
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
                className="mini-btn w-full py-4 text-sm"
              >
                Cancelar Registro
              </button>
            </div>
          </>
        )}

        {/* ============ ERROR ============ */}
        {step === "error" && errorUi && (
          <div className="px-2 pb-10 space-y-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <AlertTriangle className="h-14 w-14 text-dg-error" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-bold uppercase leading-tight tracking-[0.8px] text-dg-text">
                  {errorUi.titulo}
                </h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-dg-text-secondary">
                  {errorUi.cuerpo}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {errorUi.acciones.map((accion) => (
                <button
                  key={accion.etiqueta}
                  onClick={() =>
                    accion.tipo === "navegar" && accion.destino
                      ? navigate(accion.destino)
                      : (setStep("form"), setErrorUi(null), setError(""))
                  }
                  className={`mini-btn h-14 w-full text-sm ${accion.tipo === "navegar" ? "" : "mini-btn-strong"}`}
                >
                  {accion.etiqueta}
                </button>
              ))}
              <button 
                onClick={() => navigate("/users")}
                className="mini-btn h-14 w-full text-sm"
              >
                Volver a Usuarios
              </button>
            </div>

            {/* Codigo corto y copiable: lo unico tecnico que ve el usuario,
                y solo porque soporte lo necesita para reproducir el caso. */}
            <p className="text-center text-2xs text-dg-text-muted">
              Código de error: <span className="font-mono tabular">{errorUi.codigo}</span>
            </p>
          </div>
        )}

        {/* ============ ÉXITO ============ */}
        {step === "success" && (
          <div className="px-2 pb-10 space-y-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <CheckCircle className="h-16 w-16 text-dg-success" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-bold uppercase leading-tight tracking-[0.8px] text-dg-text">¡Registro Exitoso!</h2>
                <p className="text-dg-text-secondary text-sm mt-1">
                  {(usuarioCreado?.nombre ?? name).split(" ")[0]} ya puede acceder.
                </p>
              </div>
            </div>

            <div className="mini-card flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-dg-border">
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
              <div className="flex items-center gap-1.5 border border-dg-success/50 px-3 py-1">
                <span aria-hidden="true" className="h-2 w-2 bg-dg-success" />
                <span className="text-2xs font-bold uppercase tracking-[0.8px] text-dg-success">Activo</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="relative flex justify-between items-center px-2">
                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-dg-success -translate-y-1/2 z-0" />
                {ANGULOS.map((a) => (
                  <div key={a.step} className="relative z-10 flex flex-col items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center bg-dg-success">
                      <Check className="w-4 h-4 text-dg-bg" strokeWidth={3} aria-hidden="true" />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">
                {usuarioCreado?.num_angulos ?? 5} de 5 ángulos capturados
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="mini-card flex flex-col items-center justify-center p-4">
                <span className="tabular text-2xl font-bold text-dg-text">{usuarioCreado?.num_angulos ?? 5}</span>
                <span className="text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Ángulos</span>
              </div>
              <div className="mini-card flex flex-col items-center justify-center p-4 text-center">
                <ShieldCheck className="h-6 w-6 text-dg-success" aria-hidden="true" />
                <span className="mt-1 text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Plantilla cifrada</span>
              </div>
            </div>

            <button 
              onClick={() => navigate("/users")}
              className="mini-btn mini-btn-strong flex h-14 w-full items-center justify-center gap-2 text-sm"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              <span>Volver a Usuarios</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
