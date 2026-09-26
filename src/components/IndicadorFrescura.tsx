import { useEffect, useState } from "react";
import { evaluarFrescura, type EstadoFrescura } from "../lib/frescura";

/**
 * Indica cuánto hace que el dato que se está viendo es cierto.
 *
 * Se recalcula cada segundo por su cuenta: si dependiera solo de que llegue
 * una respuesta nueva, un backend caído dejaría el indicador congelado en
 * "En directo" para siempre, que es exactamente el fallo que viene a tapar.
 */
export function useFrescura(ultimoExito: number | null, intervaloMs: number): EstadoFrescura {
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (ultimoExito === null) {
    return { nivel: "retrasado", texto: "Cargando…", atenuar: false };
  }
  return evaluarFrescura(ahora - ultimoExito, intervaloMs, ultimoExito);
}

export default function IndicadorFrescura({
  estado,
  className = "",
}: {
  estado: EstadoFrescura;
  className?: string;
}) {
  const color =
    estado.nivel === "fresco"
      ? "text-dg-success"
      : estado.nivel === "retrasado"
        ? "text-dg-warning"
        : "text-dg-error";

  // Sin `animate-pulse`: en la variante minimalista nada late en bucle.
  const punto =
    estado.nivel === "fresco"
      ? "bg-dg-success"
      : estado.nivel === "retrasado"
        ? "bg-dg-warning"
        : "bg-dg-error";

  return (
    <span
      // Solo se anuncia cuando el dato deja de ser de fiar: un lector de
      // pantalla no necesita oir "En directo" cada segundo.
      role={estado.nivel === "obsoleto" ? "alert" : undefined}
      className={`inline-flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.8px] ${color} ${className}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 ${punto}`} />
      {estado.texto}
    </span>
  );
}

/**
 * Envoltorio que atenúa su contenido cuando el dato ya no es fiable, para que
 * sea físicamente incómodo leer un número muerto como si fuera actual.
 */
export function ContenidoFrescura({
  estado,
  children,
  className = "",
}: {
  estado: EstadoFrescura;
  children: React.ReactNode;
  /** Permite que el envoltorio herede el alto de su contenedor. */
  className?: string;
}) {
  return (
    <div className={`relative flex flex-col ${className}`}>
      <div
        className={`flex min-h-0 flex-1 flex-col ${
          estado.atenuar ? "pointer-events-none opacity-40" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
