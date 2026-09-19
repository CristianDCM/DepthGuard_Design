import { Link, useLocation } from "react-router-dom";
import { Home, Video, History, Users, Settings } from "lucide-react";
import { cn } from "@/src/lib/utils";

/**
 * Navegación principal, en dos formas según el tamaño de pantalla.
 *
 * En escritorio es una barra horizontal fija arriba, con el logotipo a la
 * izquierda y los destinos centrados sobre el ancho completo. En móvil se
 * mantiene la barra de pestañas inferior, que ahí es lo correcto: queda al
 * alcance del pulgar.
 *
 * Las pantallas ya no llevan cabecera propia con su título, así que esta
 * barra es también la que dice dónde estás: el destino activo va resaltado.
 */

const ITEMS = [
  { name: "Inicio", icon: Home, path: "/dashboard" },
  { name: "Vivo", icon: Video, path: "/live" },
  { name: "Historial", icon: History, path: "/history" },
  { name: "Usuarios", icon: Users, path: "/users" },
  { name: "Ajustes", icon: Settings, path: "/settings" },
];

/** Alto de la barra superior. Las pantallas compensan con `lg:pt-16`. */
export const ALTO_SUPERIOR = "4rem";

export default function Navigation() {
  return (
    <>
      <BarraInferior />
      <BarraSuperior />
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
              // min-w/min-h explicitos: el area pulsable debe llegar a los
              // 44px aunque el icono y el texto ocupen menos.
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

function BarraSuperior() {
  const location = useLocation();
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 top-0 z-50 hidden h-16 border-b border-dg-border bg-dg-bg/90 backdrop-blur-md lg:block"
    >
      <div className="relative mx-auto flex h-full max-w-7xl items-center px-6">
        <Link to="/dashboard" aria-label="DepthGuard — ir al inicio" className="flex shrink-0 items-center rounded-dg">
          <img src="/logo.svg" alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
        </Link>

        {/*
          Centrado respecto al ancho completo, no respecto al hueco que deja
          el logotipo: con `justify-center` sobre el resto de la fila, los
          destinos quedarian desplazados a la derecha.
        */}
        <ul className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1">
          {ITEMS.map((item) => {
            const activo = location.pathname === item.path;
            return (
              <li key={item.name}>
                <Link
                  to={item.path}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-dg px-4 py-2 text-sm font-medium transition-colors",
                    activo
                      ? "bg-dg-action/12 text-dg-action-text"
                      : "text-dg-text-secondary hover:bg-dg-input hover:text-dg-text"
                  )}
                >
                  <item.icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
