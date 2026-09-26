import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Filter, X } from "lucide-react";
import { cn } from "@/src/lib/utils";

/**
 * Desplegable de filtro en la cabecera de una columna, al estilo de una hoja
 * de cálculo: el rótulo de la columna es el botón, y el embudo se marca
 * cuando esa columna está filtrando.
 *
 * El panel va en `position: fixed` con las coordenadas del botón, no en
 * `absolute`: la tabla vive dentro de un contenedor con `overflow-auto`, que
 * recortaría cualquier hijo posicionado dentro de él. Al desplazar o
 * redimensionar se recalcula, para que no se despegue del botón.
 */
export default function FiltroColumna({
  etiqueta,
  activo,
  onLimpiar,
  alineacion = "izquierda",
  ancho = 256,
  children,
}: {
  etiqueta: string;
  /** La columna tiene filtro puesto: el embudo se rellena. */
  activo: boolean;
  onLimpiar: () => void;
  alineacion?: "izquierda" | "derecha";
  ancho?: number;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const idPanel = useId();

  const colocar = () => {
    const caja = botonRef.current?.getBoundingClientRect();
    if (!caja) return;
    const izquierdaCruda = alineacion === "derecha" ? caja.right - ancho : caja.left;
    // Sin este tope, el panel de las últimas columnas se sale de la ventana.
    const left = Math.max(8, Math.min(izquierdaCruda, window.innerWidth - ancho - 8));
    setPos({ top: caja.bottom + 4, left });
  };

  useLayoutEffect(() => {
    if (!abierto) return;
    colocar();
    // `capture`: el desplazamiento que importa es el del contenedor de la
    // tabla, y no burbujea hasta window.
    const alMover = () => colocar();
    window.addEventListener("scroll", alMover, true);
    window.addEventListener("resize", alMover);
    return () => {
      window.removeEventListener("scroll", alMover, true);
      window.removeEventListener("resize", alMover);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, alineacion, ancho]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || botonRef.current?.contains(t)) return;
      setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAbierto(false);
        botonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  return (
    <>
      <button
        ref={botonRef}
        type="button"
        aria-expanded={abierto}
        aria-controls={abierto ? idPanel : undefined}
        aria-label={`Filtrar por ${etiqueta}${activo ? " (filtro activo)" : ""}`}
        onClick={() => setAbierto((v) => !v)}
        className={cn(
          "flex w-full items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.8px]",
          activo ? "text-dg-text" : "text-dg-text-muted hover:text-dg-text"
        )}
      >
        {etiqueta}
        <Filter
          aria-hidden="true"
          className={cn("h-3 w-3 shrink-0", activo ? "fill-current" : "opacity-50")}
        />
      </button>

      {abierto && pos && (
        <div
          ref={panelRef}
          id={idPanel}
          role="dialog"
          aria-label={`Filtro de ${etiqueta}`}
          style={{ top: pos.top, left: pos.left, width: ancho }}
          className="fixed z-[60] border border-dg-border-hi bg-dg-bg p-3"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-2xs font-bold uppercase tracking-[0.8px] text-dg-text">
              {etiqueta}
            </span>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar el filtro"
              className="text-dg-text-muted hover:text-dg-text"
            >
              <X aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="space-y-3 text-left font-normal normal-case tracking-normal">
            {children}
          </div>

          <button
            type="button"
            onClick={onLimpiar}
            disabled={!activo}
            className="btn mt-3 w-full py-1.5 text-2xs disabled:opacity-40"
          >
            Limpiar columna
          </button>
        </div>
      )}
    </>
  );
}
