import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
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
  if (passed <= 1) return { level: 1, label: "Muy débil", color: "bg-dg-error" };
  if (passed <= 2) return { level: 2, label: "Débil", color: "bg-dg-error" };
  if (passed <= 3) return { level: 3, label: "Media", color: "bg-dg-warning" };
  if (passed <= 4) return { level: 4, label: "Fuerte", color: "bg-dg-success" };
  return { level: 5, label: "Muy fuerte", color: "bg-dg-success" };
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
      <main className="mini min-h-screen flex flex-col items-center justify-center p-6">
        <p role="status" className="text-xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Validando invitación</p>
      </main>
    );
  }

  // Estado: token inválido o expirado
  if (!tokenValid) {
    return (
      <main className="mini min-h-screen flex flex-col items-center justify-center p-6">
        <div className="mini-card w-full max-w-sm space-y-4 p-8 text-center">
          <AlertTriangle className="mx-auto h-16 w-16 text-dg-error" aria-hidden="true" />
          <h1 className="text-xl font-bold uppercase tracking-[0.8px]">Enlace inválido</h1>
          <p className="text-dg-text-muted text-sm">
            Este enlace de invitación ha expirado o ya fue utilizado.
            Contacta al administrador para recibir una nueva invitación.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mini-btn mini-btn-strong mt-4 w-full py-3 text-sm"
          >
            Ir al inicio de sesión
          </button>
        </div>
      </main>
    );
  }

  // Estado: éxito
  if (success) {
    return (
      <main className="mini min-h-screen flex flex-col items-center justify-center p-6">
        <div className="mini-card w-full max-w-sm space-y-4 p-8 text-center">
          <CheckCircle className="mx-auto h-20 w-20 text-dg-success" aria-hidden="true" />
          <h1 className="text-xl font-bold uppercase tracking-[0.8px]">¡Contraseña establecida!</h1>
          <p className="text-sm text-dg-text-muted">
            Tu cuenta ha sido activada exitosamente. Serás redirigido al inicio de sesión.
          </p>
        </div>
      </main>
    );
  }

  // Formulario principal
  return (
    <main className="mini min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/logo.svg"
            alt="DepthGuard Logo"
            className="mb-4 h-24 w-24 object-contain"
          />
          <h1 className="text-3xl font-bold tracking-[0.8px] text-dg-text">Bienvenido</h1>
          <p className="mt-2 text-xs uppercase tracking-[0.8px] text-dg-text-muted">Establece tu contraseña para activar tu cuenta</p>
        </div>

        <div className="mini-card w-full p-8">
          <form className="space-y-5" onSubmit={handleSubmit}>
            {/* Campo: Nueva contraseña */}
            <div className="space-y-2">
              <label htmlFor="input-password" className="block text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">
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
                  className="w-full border border-dg-border bg-transparent py-3 pl-10 pr-12 text-base text-dg-text placeholder:text-dg-text-muted focus:border-dg-text"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPassword}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dg-text-muted hover:text-dg-text"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            {/* Indicador de fortaleza */}
            {password.length > 0 && (
              <div className="space-y-3">
                  {/* Barra de fuerza */}
                  <div className="space-y-1.5">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 ${
                            i <= strength.level ? strength.color : "bg-dg-border"
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-2xs font-bold uppercase tracking-[0.8px] ${
                      strength.level >= 4 ? "text-dg-success" : strength.level >= 3 ? "text-dg-warning" : "text-dg-error"
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
              </div>
            )}

            {/* Campo: Confirmar contraseña */}
            <div className="space-y-2">
              <label htmlFor="input-confirm-password" className="block text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">
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
                  className={`w-full border bg-transparent py-3 pl-10 pr-12 text-base text-dg-text placeholder:text-dg-text-muted ${
                    confirm.length > 0
                      ? passwordsMatch
                        ? "border-dg-success"
                        : "border-dg-error"
                      : "border-dg-border focus:border-dg-text"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? "Ocultar confirmación de contraseña" : "Mostrar confirmación de contraseña"}
                  aria-pressed={showConfirm}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-dg-text-muted hover:text-dg-text"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                </button>
              </div>
              {confirm.length > 0 && !passwordsMatch && (
                <p className="text-xs text-dg-error">Las contraseñas no coinciden</p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div role="alert" className="border border-dg-error px-3 py-2 text-center text-sm text-dg-error">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              id="btn-set-password"
              type="submit"
              disabled={!canSubmit}
              className="mini-btn mini-btn-strong flex w-full items-center justify-center gap-2 py-4 text-sm disabled:cursor-not-allowed disabled:opacity-30"
            >
              {isLoading ? "Guardando" : "Activar cuenta"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
