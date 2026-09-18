import { useEffect, useRef } from "react";
import { ShieldAlert, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { Evento } from "../lib/supabase";

/**
 * Alerta de intento de suplantación.
 *
 * Hasta ahora un fraude producía un cambio de borde y un velo rojo al 5 % de
 * opacidad. En una consola de seguridad, la alerta crítica tiene que ser
 * imposible de pasar por alto, y esa se perdía con solo mirar a otro lado.
 *
 * Lo que hace distinta a esta:
 *   - no se cierra sola: exige un acuse explícito
 *   - se anuncia con role="alert"
 *   - cambia el título de la pestaña, para que se vea con el panel de fondo
 *   - acumula, en vez de que un fraude tape al anterior
 *
 * LIMITACIÓN CONOCIDA — el acuse es solo local.
 *
 * "Reconocer" silencia la alerta en ESTA pestaña y nada más: no queda
 * registrado quién la reconoció ni cuándo, y otro operador con el panel
 * abierto sigue viéndola. Para una traza de auditoría de verdad hace falta
 * respaldo en el servidor, que hoy no existe: el esquema no tiene ninguna
 * columna ni tabla de acuse (ver supabase_migration_v3.sql).
 *
 * Lo mínimo sería un `historial.reconocido_por` y `historial.reconocido_en`,
 * y que este botón escribiera ahí. Se deja anotado en lugar de simularlo,
 * porque una traza de auditoría que en realidad no se guarda es peor que no
 * tener ninguna: se confía en ella exactamente cuando más importa.
 */
export default function AlertaFraude({
  eventos,
  onReconocer,
}: {
  /** Fraudes sin reconocer, del más reciente al más antiguo. */
  eventos: Evento[];
  onReconocer: () => void;
}) {
  const tituloOriginal = useRef<string>("");

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!tituloOriginal.current) tituloOriginal.current = document.title;

    document.title = eventos.length
      ? `(${eventos.length}) ⚠ Fraude — DepthGuard`
      : tituloOriginal.current;

    return () => {
      if (tituloOriginal.current) document.title = tituloOriginal.current;
    };
  }, [eventos.length]);

  const ultimo = eventos[0];

  return (
    <AnimatePresence>
      {ultimo && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          role="alert"
          aria-live="assertive"
          className="fixed inset-x-0 top-0 z-[60] px-3 pt-safe"
        >
          <div className="mx-auto mt-2 flex max-w-2xl items-center gap-3 rounded-dg border-2 border-dg-error bg-dg-card px-4 py-3 shadow-dg-lg">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dg-error/15">
              <ShieldAlert className="h-5 w-5 text-dg-error" aria-hidden="true" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-dg-error">
                Intento de suplantación detectado
                {eventos.length > 1 && (
                  <span className="ml-1.5 rounded-dg-sm bg-dg-error/20 px-1.5 py-0.5 text-2xs tabular">
                    {eventos.length}
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-dg-text-secondary">
                {ultimo.motivo ?? "Sin motivo registrado"}
                {" · "}
                <span className="tabular">
                  {new Date(ultimo.timestamp).toLocaleTimeString("es", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  })}
                </span>
              </p>
            </div>

            <button
              onClick={onReconocer}
              className="shrink-0 rounded-dg bg-dg-error px-3 py-2 text-xs font-bold text-dg-bg transition-[filter] hover:brightness-110"
            >
              Reconocer
              <X className="ml-1 inline h-3 w-3" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
