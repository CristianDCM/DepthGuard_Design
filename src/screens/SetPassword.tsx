import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { setNewPassword, getSessionActual } from "../lib/supabase";

/**
 * Reglas de validación de contraseña.
 * Cada regla tiene un label visible y un test regex/function.
 */
const PASSWORD_RULES = [
  { id: "length", label: "Mínimo 8 caracteres", test: (p: string) => p.length >= 8 },
  { id: "upper", label: "Al menos 1 mayúscula", test: (p: string) => /[A-Z]/.test(p) },
  { id: "lower", label: "Al menos 1 minúscula", test: (p: string) => /[a-z]/.test(p) },
  { id: "number", label: "Al menos 1 número", test: (p: string) => /[0-9]/.test(p) },
  { id: "special", label: "Al menos 1 carácter especial (!@#$...)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(password: string): { level: number; label: string; color: string } {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length;
  if (passed <= 1) return { level: 1, label: "Muy débil", color: "bg-red-500" };
  if (passed <= 2) return { level: 2, label: "Débil", color: "bg-orange-500" };
  if (passed <= 3) return { level: 3, label: "Media", color: "bg-yellow-500" };
  if (passed <= 4) return { level: 4, label: "Fuerte", color: "bg-emerald-400" };
  return { level: 5, label: "Muy fuerte", color: "bg-emerald-500" };
}

export default function SetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  // Al montar, verificar que hay una sesión válida (Supabase la crea automáticamente
  // cuando el usuario hace clic en el enlace de invitación)
  useEffect(() => {
    async function validateToken() {
      try {
        const session = await getSessionActual();
        if (session) {
          setTokenValid(true);
        } else {
          setTokenValid(false);
        }
      } catch {
        setTokenValid(false);
      } finally {
        setValidatingToken(false);
      }
    }
    // Dar un momento para que Supabase procese los hash params de la URL
    const timer = setTimeout(validateToken, 1000);
    return () => clearTimeout(timer);
  }, []);

  const strength = getStrength(password);
  const allRulesPassed = PASSWORD_RULES.every((r) => r.test(password));
  const passwordsMatch = password === confirm && confirm.length > 0;
  const canSubmit = allRulesPassed && passwordsMatch && !isLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsLoading(true);
    setError(null);

    try {
      await setNewPassword(password);
      setSuccess(true);
      // Redirigir al login después de 3 segundos
      setTimeout(() => navigate("/"), 3000);
    } catch (err: any) {
      setError(err.message || "Error al establecer la contraseña. El enlace puede haber expirado.");
      setIsLoading(false);
    }
  };

  // Estado: validando token
  if (validatingToken) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-8 h-8 border-2 border-dg-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-dg-text-muted text-sm mt-4">Validando invitación...</p>
      </main>
    );
  }

  // Estado: token inválido o expirado
  if (!tokenValid) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="cyber-card p-8 max-w-sm w-full text-center space-y-4"
        >
          <AlertTriangle className="w-16 h-16 text-dg-error mx-auto" />
          <h1 className="text-xl font-bold font-headline">Enlace inválido</h1>
          <p className="text-dg-text-muted text-sm">
            Este enlace de invitación ha expirado o ya fue utilizado.
            Contacta al administrador para recibir una nueva invitación.
          </p>
          <button
            onClick={() => navigate("/")}
            className="btn-primary w-full py-3 mt-4"
          >
            Ir al inicio de sesión
          </button>
        </motion.div>
      </main>
    );
  }

  // Estado: éxito
  if (success) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="cyber-card p-8 max-w-sm w-full text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
          >
            <CheckCircle className="w-20 h-20 text-dg-success mx-auto" />
          </motion.div>
          <h1 className="text-xl font-bold font-headline">¡Contraseña establecida!</h1>
          <p className="text-dg-text-muted text-sm">
            Tu cuenta ha sido activada exitosamente. Serás redirigido al inicio de sesión...
          </p>
          <div className="w-full bg-dg-border rounded-full h-1 overflow-hidden">
            <motion.div
              className="h-full bg-dg-accent"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 3 }}
            />
          </div>
        </motion.div>
      </main>
    );
  }

  // Formulario principal
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col items-center"
        >
          <div className="relative mb-4">
            <Shield className="w-20 h-20 text-dg-accent animate-pulse" />
            <div className="absolute inset-0 bg-dg-accent/20 blur-2xl rounded-full -z-10" />
          </div>
          <h1 className="text-3xl font-bold text-dg-accent tracking-tight font-headline">Bienvenido</h1>
          <p className="text-dg-text-muted text-sm mt-1">Establece tu contraseña para activar tu cuenta</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="w-full cyber-card p-8 shadow-2xl"
        >
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Campo: Nueva contraseña */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-dg-text-muted">
                Nueva contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dg-text-muted" />
                <input
                  id="input-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className="w-full bg-dg-input border-dg-border text-white rounded-dg pl-10 pr-12 py-3 focus:ring-dg-accent focus:border-dg-accent transition-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dg-text-muted hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Indicador de fortaleza */}
            <AnimatePresence>
              {password.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  {/* Barra de fuerza */}
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            i <= strength.level ? strength.color : "bg-dg-border"
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${
                      strength.level >= 4 ? "text-emerald-400" : strength.level >= 3 ? "text-yellow-500" : "text-red-400"
                    }`}>
                      {strength.label}
                    </p>
                  </div>

                  {/* Lista de reglas */}
                  <div className="space-y-1.5">
                    {PASSWORD_RULES.map((rule) => {
                      const passed = rule.test(password);
                      return (
                        <div key={rule.id} className="flex items-center gap-2">
                          {passed ? (
                            <CheckCircle className="w-3.5 h-3.5 text-dg-success flex-shrink-0" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-dg-text-muted flex-shrink-0" />
                          )}
                          <span className={`text-xs ${passed ? "text-dg-success" : "text-dg-text-muted"}`}>
                            {rule.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Campo: Confirmar contraseña */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-dg-text-muted">
                Confirmar contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dg-text-muted" />
                <input
                  id="input-confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  className={`w-full bg-dg-input border text-white rounded-dg pl-10 pr-12 py-3 focus:ring-dg-accent transition-all outline-none ${
                    confirm.length > 0
                      ? passwordsMatch
                        ? "border-dg-success focus:border-dg-success"
                        : "border-dg-error focus:border-dg-error"
                      : "border-dg-border focus:border-dg-accent"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dg-text-muted hover:text-white transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <AnimatePresence>
                {confirm.length > 0 && !passwordsMatch && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-xs text-dg-error"
                  >
                    Las contraseñas no coinciden
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Error */}
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

            {/* Submit */}
            <button
              id="btn-set-password"
              type="submit"
              disabled={!canSubmit}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Guardando...
                </>
              ) : (
                "Activar cuenta"
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
