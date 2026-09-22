import { Link } from "react-router-dom";
import { SearchX, Home } from "lucide-react";

/**
 * Pantalla 404.
 *
 * Se monta en la ruta comodín "*": sin ella, cualquier URL desconocida
 * renderizaba una pantalla en blanco sin ningún mensaje.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-dg-bg flex items-center justify-center p-4">
      <div className="card w-full max-w-md space-y-5 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center border border-dg-warning/50">
          <SearchX className="w-8 h-8 text-dg-warning" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <p className="tabular text-5xl font-bold tracking-[0.8px] text-dg-text-muted">404</p>
          <h1 className="text-xl font-bold uppercase tracking-[0.8px] text-dg-text">
            Página no encontrada
          </h1>
          <p className="text-sm text-dg-text-muted leading-relaxed">
            La dirección que intentas abrir no existe o fue movida.
          </p>
        </div>

        <Link
          to="/dashboard"
          className="btn btn-strong flex w-full items-center justify-center gap-2 py-3 text-sm"
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
