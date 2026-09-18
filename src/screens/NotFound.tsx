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
      <div className="cyber-card p-8 max-w-md w-full text-center space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-dg-warning/10 border border-dg-warning/30 flex items-center justify-center">
          <SearchX className="w-8 h-8 text-dg-warning" aria-hidden="true" />
        </div>

        <div className="space-y-2">
          <p className="text-5xl font-black font-headline text-dg-text-muted">404</p>
          <h1 className="text-xl font-bold font-headline text-dg-text">
            Página no encontrada
          </h1>
          <p className="text-sm text-dg-text-muted leading-relaxed">
            La dirección que intentas abrir no existe o fue movida.
          </p>
        </div>

        <Link
          to="/dashboard"
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" aria-hidden="true" />
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
