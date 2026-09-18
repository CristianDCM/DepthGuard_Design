import { Link, useLocation } from "react-router-dom";
import { Home, Video, History, Users, Settings } from "lucide-react";
import { cn } from "@/src/lib/utils";

/**
 * Navegación principal, en dos formas según el tamaño de pantalla.
 *
 * Antes había una sola: la barra de pestañas inferior, anclada al borde de
 * la ventana en TODOS los tamaños. Un puesto de control de 27 pulgadas
 * recibía una barra de pestañas de teléfono pegada abajo del todo, con
 * 2.500 píxeles de ancho desaprovechados a los lados.
 *
 * A partir de 1024px pasa a barra lateral fija de 240px, que es lo que
 * espera alguien que usa esto como herramienta de trabajo durante un turno
 * entero. Los destinos son los mismos: cambia el envase, no el mapa.
 */

const ITEMS = [
  { name: "Inicio", icon: Home, path: "/dashboard" },
  { name: "Vivo", icon: Video, path: "/live" },
  { name: "Historial", icon: History, path: "/history" },
  { name: "Usuarios", icon: Users, path: "/users" },
  { name: "Ajustes", icon: Settings, path: "/settings" },
];

/** Ancho de la barra lateral. Las pantallas compensan con `lg:pl-60`. */
export const ANCHO_LATERAL = "15rem"; // 240px

export default function Navigation() {
  return (
    <>
      <BarraInferior />
      <BarraLateral />
    </>
  );
}

function BarraInferior() {
  const location = useLocation();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-dg-border bg-dg-bg px-2 pb-safe lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-around">
        {ITEMS.map((item) => {
          const activo = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              aria-current={activo ? "page" : undefined}
              // min-w/min-h explicitos: antes el area pulsable era solo la
              // del icono y el texto, por debajo de los 44px recomendados.
              className={cn(
                "flex min-h-[44px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-dg transition-colors",
                activo ? "text-dg-action-text" : "text-dg-text-muted hover:text-dg-text"
              )}
            >
              <item.icon aria-hidden="true" className={cn("h-5 w-5", activo && "fill-dg-action-text/20")} />
              <span className="text-2xs font-bold uppercase">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function BarraLateral() {
  const location = useLocation();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-y-0 left-0 z-50 hidden w-60 flex-col border-r border-dg-border bg-dg-card lg:flex"
    >
      <div className="flex items-center gap-2.5 px-5 py-5">
        <img src="/logo.svg" alt="" aria-hidden="true" className="h-7 w-7 object-contain" />
        <span className="headline text-base font-bold text-dg-text">
          Depth<span className="text-dg-brand">Guard</span>
        </span>
      </div>

      <ul className="flex flex-1 flex-col gap-1 px-3">
        {ITEMS.map((item) => {
          const activo = location.pathname === item.path;
          return (
            <li key={item.name}>
              <Link
                to={item.path}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-dg px-3 py-2.5 text-sm font-medium transition-colors",
                  activo
                    ? "bg-dg-action/12 text-dg-action-text"
                    : "text-dg-text-secondary hover:bg-dg-input hover:text-dg-text"
                )}
              >
                <item.icon aria-hidden="true" className="h-4.5 w-4.5 shrink-0" />
                {item.name}
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="px-5 py-4 text-2xs text-dg-text-off">
        Control de acceso biométrico 3D
      </p>
    </nav>
  );
}
