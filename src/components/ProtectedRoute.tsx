import type React from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getUsuarioAuth, onAuthChange, logoutAdmin } from "../lib/supabase";

/** Tiempo de inactividad antes de cerrar sesión automáticamente (ms) */
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos

/** Tiempo antes del cierre para mostrar el aviso (ms) */
const WARNING_BEFORE_MS = 60 * 1000; // 60 segundos antes

/** Eventos que resetean el timer de inactividad */
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

/**
 * Componente que protege rutas autenticadas.
 * 
 * Seguridad implementada:
 * 1. Valida sesión SOLO con Supabase Auth (NO localStorage)
 * 2. Escucha onAuthStateChange para reaccionar si la sesión es revocada
 * 3. Auto-logout por inactividad (15 min) con aviso previo (60s antes)
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const navigate = useNavigate();

  // Refs para timers (evitar closures obsoletos)
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLoggingOut = useRef(false);

  /** Cerrar sesión de forma segura (una sola vez) */
  const handleForceLogout = useCallback(async () => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;

    // Limpiar todos los timers
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);

    await logoutAdmin();
    navigate("/", { replace: true });
  }, [navigate]);

  /** Resetear el timer de inactividad */
  const resetInactivityTimer = useCallback(() => {
    // Si ya hay aviso visible, ocultarlo
    setShowWarning(false);
    setCountdown(60);

    // Limpiar timers existentes
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);

    // Timer de aviso: se muestra 60s antes del cierre
    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(60);

      // Iniciar cuenta regresiva visual
      let remaining = 60;
      countdownInterval.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          if (countdownInterval.current) clearInterval(countdownInterval.current);
        }
      }, 1000);
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

    // Timer de cierre: cerrar sesión tras 15 minutos
    inactivityTimer.current = setTimeout(() => {
      handleForceLogout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [handleForceLogout]);

  // === Verificación inicial de sesión ===
  useEffect(() => {
    async function verificar() {
      // SOLO validar con Supabase Auth — NUNCA confiar en localStorage
      const user = await getUsuarioAuth();
      if (!user) {
        setAuthenticated(false);
      } else {
        setAuthenticated(true);
      }
      setChecking(false);
    }
    verificar();
  }, []);

  // === Escuchar cambios de sesión en tiempo real ===
  useEffect(() => {
    const unsubscribe = onAuthChange((event, _session) => {
      // Si la sesión es revocada o cerrada desde otro lugar
      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED" && !_session) {
        setAuthenticated(false);
        navigate("/", { replace: true });
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // === Auto-logout por inactividad ===
  useEffect(() => {
    if (!authenticated) return;

    // Iniciar timer
    resetInactivityTimer();

    // Escuchar actividad del usuario
    const handleActivity = () => resetInactivityTimer();

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      // Cleanup
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, [authenticated, resetInactivityTimer]);

  // Estado: verificando sesión
  if (checking) {
    return (
      <div className="min-h-screen bg-dg-bg flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-dg-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Estado: no autenticado
  if (!authenticated) {
    return <Navigate to="/" replace />;
  }

  // Estado: autenticado
  return (
    <>
      {children}

      {/* Aviso de inactividad */}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="cyber-card p-6 max-w-sm w-full text-center space-y-4 animate-in fade-in zoom-in">
            <div className="w-16 h-16 mx-auto rounded-full bg-dg-warning/10 flex items-center justify-center">
              <span className="text-3xl font-black text-dg-warning font-headline">{countdown}</span>
            </div>
            <h2 className="text-lg font-bold font-headline">Sesión por expirar</h2>
            <p className="text-sm text-dg-text-muted">
              Tu sesión se cerrará automáticamente por inactividad.
              Mueve el mouse o presiona una tecla para continuar.
            </p>
            <button
              onClick={resetInactivityTimer}
              className="btn-primary w-full py-3"
            >
              Continuar sesión
            </button>
          </div>
        </div>
      )}
    </>
  );
}
