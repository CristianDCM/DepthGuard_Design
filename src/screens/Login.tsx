import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Shield, Lock, AlertTriangle } from "lucide-react";
import { loginAdmin } from "../lib/supabase";
import { getLockoutSeconds, LOCKOUT_THRESHOLDS } from "../lib/loginLockout";

// ============================================
// Rate limiting — anti fuerza bruta
// ============================================

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
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/logo.svg"
            alt="DepthGuard Logo"
            className="mb-4 h-24 w-24 object-contain"
          />
          <h1 className="text-4xl font-bold tracking-[0.8px] text-dg-text">
            Depth<span className="text-dg-brand">Guard</span>
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.8px] text-dg-text-muted">
            Sistema de Control de Acceso 3D
          </p>
        </div>

        <div className="card w-full p-8">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-2">
              <label htmlFor="login-email" className="block text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">
                Correo corporativo
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="nombre@empresa.com"
                required
                disabled={isLocked}
                aria-describedby={error ? "login-error" : undefined}
                className="w-full border border-dg-border bg-transparent px-4 py-3 text-base text-dg-text placeholder:text-dg-text-muted focus:border-dg-text disabled:cursor-not-allowed disabled:opacity-40"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="block text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                  disabled={isLocked}
                  aria-describedby={error ? "login-error" : undefined}
                  className="w-full border border-dg-border bg-transparent px-4 py-3 pr-12 text-base text-dg-text placeholder:text-dg-text-muted focus:border-dg-text disabled:cursor-not-allowed disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dg-text-muted hover:text-dg-text"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* Mensajes de error y bloqueo */}
            {error && (
              <div
                id="login-error"
                role="alert"
                className="border border-dg-error px-3 py-2 text-center text-sm text-dg-error"
              >
                {error}
              </div>
            )}

            {/* Aviso visual de bloqueo con countdown */}
            {isLocked && remainingSeconds > 0 && (
              <div role="status" className="space-y-2 border border-dg-warning/50 p-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <Lock className="h-4 w-4 text-dg-warning" aria-hidden="true" />
                  <span className="text-xs font-bold uppercase tracking-[0.8px] text-dg-warning">
                    Acceso bloqueado
                  </span>
                </div>
                <div className="tabular text-2xl font-bold text-dg-warning">
                  {formatTime(remainingSeconds)}
                </div>
                <p className="text-xs text-dg-text-muted">
                  {attemptState.attempts} intentos fallidos registrados
                </p>
              </div>
            )}

            {/* Aviso de seguridad cuando hay muchos intentos */}
            {attemptState.attempts >= 5 && !isLocked && (
              <div className="flex items-start gap-2 border border-dg-warning/50 p-3 text-xs text-dg-warning">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Se han registrado múltiples intentos fallidos. Los bloqueos se incrementarán progresivamente.</span>
              </div>
            )}

            <button
              id="btn-login"
              type="submit"
              disabled={isLoading || isLocked}
              className="btn btn-strong flex w-full items-center justify-center gap-2 py-4 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Verificando" : isLocked ? "Bloqueado" : "Iniciar Sesión"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
