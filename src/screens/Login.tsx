import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Shield } from "lucide-react";
import { motion } from "motion/react";
import { loginAdmin } from "../lib/supabase";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);

    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const user = await loginAdmin(email, password);
      if (user) {
        // Supabase Auth maneja la sesión automáticamente (JWT en localStorage)
        // Guardamos un flag adicional para ProtectedRoute
        localStorage.setItem("dg_admin", JSON.stringify({ email: user.email, id: user.id }));
        navigate("/dashboard");
      } else {
        setError(true);
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Error de login:", err);
      setError(true);
      setIsLoading(false);
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
            <Shield className="w-20 h-20 text-dg-accent animate-pulse" />
            <div className="absolute inset-0 bg-dg-accent/20 blur-2xl rounded-full -z-10" />
          </div>
          <h1 className="text-4xl font-bold text-dg-accent tracking-tight font-headline">DepthGuard</h1>
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
                className="w-full bg-dg-input border-dg-border text-white rounded-dg px-4 py-3 focus:ring-dg-accent focus:border-dg-accent transition-all outline-none"
              />
            </div>

            <div className="space-y-2">
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Contraseña"
                  required
                  className="w-full bg-dg-input border-dg-border text-white rounded-dg px-4 py-3 focus:ring-dg-accent focus:border-dg-accent transition-all outline-none pr-12"
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

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-dg-error/10 border border-dg-error text-dg-error text-sm py-2 px-3 rounded-dg text-center"
              >
                Credenciales incorrectas. Intente de nuevo.
              </motion.div>
            )}

            <button
              id="btn-login"
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? "Verificando..." : "Iniciar Sesión"}
            </button>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
