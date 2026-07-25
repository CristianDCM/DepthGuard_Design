import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Shield, Lock, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { loginAdmin } from "../lib/supabase";

// ============================================
// Rate limiting — anti fuerza bruta
// ============================================

/** Umbrales de bloqueo progresivo: [intentos, segundos de bloqueo] */
const LOCKOUT_THRESHOLDS: [number, number][] = [
  [3, 30],    // 3 intentos fallidos → 30s de bloqueo
  [5, 120],   // 5 intentos → 2 minutos
  [7, 300],   // 7 intentos → 5 minutos
  [10, 600],  // 10 intentos → 10 minutos
];

const STORAGE_KEY = "dg_login_attempts";

interface LoginAttemptState {
  attempts: number;
  lockedUntil: number | null; // timestamp
}

function getAttemptState(): LoginAttemptState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { attempts: 0, lockedUntil: null };
}

function saveAttemptState(state: LoginAttemptState) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getLockoutSeconds(attempts: number): number {
  let lockout = 0;
  for (const [threshold, seconds] of LOCKOUT_THRESHOLDS) {
    if (attempts >= threshold) lockout = seconds;
  }
  return lockout;
}

// ============================================
// Componente Login
// ============================================

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptState, setAttemptState] = useState<LoginAttemptState>(getAttemptState);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const navigate = useNavigate();

  // Verificar si está bloqueado
  const isLocked = attemptState.lockedUntil !== null && Date.now() < attemptState.lockedUntil;

  // Countdown del bloqueo
  useEffect(() => {
    if (!attemptState.lockedUntil) return;

    const updateRemaining = () => {
      const diff = Math.max(0, Math.ceil((attemptState.lockedUntil! - Date.now()) / 1000));
      setRemainingSeconds(diff);

      if (diff <= 0) {
        // Desbloquear
        const newState = { ...attemptState, lockedUntil: null };
        setAttemptState(newState);
        saveAttemptState(newState);
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [attemptState.lockedUntil]);

  const formatTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}:${s.toString().padStart(2, "0")}` : `${s}s`;
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Bloquear si está en lockout
    if (isLocked) return;

    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const user = await loginAdmin(email, password);
      if (user) {
        // Login exitoso — resetear intentos
        const resetState: LoginAttemptState = { attempts: 0, lockedUntil: null };
        saveAttemptState(resetState);
        setAttemptState(resetState);

        navigate("/dashboard");
      } else {
        handleFailedAttempt();
      }
    } catch (err) {
      console.error("Error de login:", err);
      handleFailedAttempt();
    }
  };

  const handleFailedAttempt = () => {
    const newAttempts = attemptState.attempts + 1;
    const lockoutSeconds = getLockoutSeconds(newAttempts);

    const newState: LoginAttemptState = {
      attempts: newAttempts,
      lockedUntil: lockoutSeconds > 0 ? Date.now() + lockoutSeconds * 1000 : null,
    };

    setAttemptState(newState);
    saveAttemptState(newState);
    setIsLoading(false);

    if (lockoutSeconds > 0) {
      setError(`Demasiados intentos fallidos. Bloqueado por ${formatTime(lockoutSeconds)}.`);
    } else {
      const remaining = LOCKOUT_THRESHOLDS[0][0] - newAttempts;
      setError(
        remaining > 0
          ? `Credenciales incorrectas. ${remaining} intento${remaining !== 1 ? "s" : ""} restante${remaining !== 1 ? "s" : ""} antes del bloqueo.`
          : "Credenciales incorrectas."
      );
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col items-center"
        >
          <div className="relative mb-4">
            <img
              src="/logo.svg"
              alt="DepthGuard Logo"
              className="w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(99,255,0,0.4)] z-10 relative"
            />
            <div className="absolute inset-0 bg-[#63ff00]/20 blur-3xl rounded-full -z-10" />
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight font-headline">
            Depth<span className="text-[#63ff00]">Guard</span>
          </h1>
          <p className="text-dg-text-muted text-sm mt-1">Sistema de Control de Acceso 3D</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full cyber-card p-8 shadow-2xl"
        >
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-2">
              <input
                name="email"
                type="email"
                placeholder="Correo"
                required
                disabled={isLocked}
                className="w-full bg-dg-input border-dg-border text-white rounded-dg px-4 py-3 focus:ring-dg-accent focus:border-dg-accent transition-all outline-none disabled:opacity-40 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  required
                  disabled={isLocked}
                  className="w-full bg-dg-input border-dg-border text-white rounded-dg px-4 py-3 focus:ring-dg-accent focus:border-dg-accent transition-all outline-none pr-12 disabled:opacity-40 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dg-text-muted hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Mensajes de error y bloqueo */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-dg-error/10 border border-dg-error text-dg-error text-sm py-2 px-3 rounded-dg text-center"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Aviso visual de bloqueo con countdown */}
            <AnimatePresence>
              {isLocked && remainingSeconds > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-dg-warning/5 border border-dg-warning/30 rounded-dg p-4 text-center space-y-2"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4 text-dg-warning" />
                    <span className="text-xs font-bold uppercase tracking-widest text-dg-warning">
                      Acceso bloqueado
                    </span>
                  </div>
                  <div className="text-2xl font-black text-dg-warning font-headline">
                    {formatTime(remainingSeconds)}
                  </div>
                  <p className="text-xs text-dg-text-muted">
                    {attemptState.attempts} intentos fallidos registrados
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Aviso de seguridad cuando hay muchos intentos */}
            <AnimatePresence>
              {attemptState.attempts >= 5 && !isLocked && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 text-xs text-dg-warning bg-dg-warning/5 border border-dg-warning/20 rounded-dg p-3"
                >
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Se han registrado múltiples intentos fallidos. Los bloqueos se incrementarán progresivamente.</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              id="btn-login"
              type="submit"
              disabled={isLoading || isLocked}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Verificando..." : isLocked ? "Bloqueado" : "Iniciar Sesión"}
            </button>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
