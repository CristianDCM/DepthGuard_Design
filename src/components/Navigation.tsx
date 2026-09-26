import { Link, useLocation } from "react-router-dom";
import { Home, Video, History, Users, Settings } from "lucide-react";
import { cn } from "@/src/lib/utils";

/**
 * Navegación principal, en dos formas según el tamaño de pantalla.
 *
 * En escritorio es una barra horizontal fija arriba (4rem de alto; las
 * pantallas compensan con `lg:pt-16`), con el logotipo a la izquierda y los
 * destinos alineados a la derecha, solo en texto y en mayúsculas. En móvil
 * se mantiene la barra de pestañas inferior, que ahí es lo correcto: queda
 * al alcance del pulgar.
 *
 * Las pantallas no llevan cabecera propia con su título, así que esta barra
 * es también la que dice dónde estás: el destino activo va INVERTIDO
 * (relleno del color del texto, letra del color del fondo) ocupando el alto
 * completo de la barra.
 */

const ITEMS = [
  { name: "Inicio", icon: Home, path: "/dashboard" },
  { name: "Vivo", icon: Video, path: "/live" },
  { name: "Historial", icon: History, path: "/history" },
  { name: "Usuarios", icon: Users, path: "/users" },
  { name: "Ajustes", icon: Settings, path: "/settings" },
];

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
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-dg-border bg-dg-canvas pb-safe lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-stretch">
        {ITEMS.map((item) => {
          const activo = location.pathname === item.path;
          return (
            <Link
              key={item.name}
              to={item.path}
              aria-current={activo ? "page" : undefined}
              // min-w/min-h explicitos: el area pulsable debe llegar a los
              // 44px aunque el icono y el texto ocupen menos. Cada destino
              // es una celda de la barra, y el activo se invierte entero.
              className={cn(
                "flex min-h-[44px] min-w-[64px] flex-1 flex-col items-center justify-center gap-1",
                activo ? "bg-dg-text text-dg-bg" : "text-dg-text-muted"
              )}
            >
              <item.icon aria-hidden="true" className="h-5 w-5" />
              <span className="text-2xs font-bold uppercase tracking-[0.8px]">{item.name}</span>
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
      className="fixed inset-x-0 top-0 z-50 hidden h-16 border-b border-dg-border bg-dg-canvas lg:block"
    >
      <div className="mx-auto flex h-full max-w-7xl items-stretch px-6">
        <Link
          to="/dashboard"
          aria-label="DepthGuard — ir al inicio"
          className="flex shrink-0 items-center"
        >
          <span aria-hidden="true" className="text-xl font-bold uppercase tracking-[0.8px] text-dg-text">
            Depth<span className="text-dg-brand">Guard</span>
          </span>
        </Link>

        <ul className="ml-auto flex items-stretch">
          {ITEMS.map((item) => {
            const activo = location.pathname === item.path;
            return (
              <li key={item.name} className="flex">
                <Link
                  to={item.path}
                  aria-current={activo ? "page" : undefined}
                  className={cn(
                    "flex items-center px-6 text-sm font-medium uppercase tracking-[0.8px]",
                    activo
                      ? "bg-dg-text font-semibold text-dg-bg"
                      : "text-dg-text-muted hover:bg-dg-text hover:text-dg-bg"
                  )}
                >
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
