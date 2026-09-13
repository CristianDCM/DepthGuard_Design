import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Captura errores de renderizado en cualquier punto del árbol de componentes.
 *
 * Sin esto, un error no controlado desmonta toda la aplicación y el usuario
 * se queda con una pantalla en blanco sin explicación ni forma de recuperarse.
 *
 * Debe ser un componente de clase: React no expone todavía un equivalente
 * con hooks para getDerivedStateFromError / componentDidCatch.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // En desarrollo dejamos la traza completa en consola; en producción
    // el build elimina los console.* (ver vite.config.ts).
    console.error("[ErrorBoundary] Error no controlado:", error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/dashboard";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-dg-bg flex items-center justify-center p-4">
        <div className="cyber-card p-8 max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-dg-error/10 border border-dg-error/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-dg-error" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold font-headline text-white">
              Algo salió mal
            </h1>
            <p className="text-sm text-dg-text-muted leading-relaxed">
              La aplicación encontró un error inesperado. Tus datos no se han
              visto afectados: puedes recargar la vista y continuar.
            </p>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <pre className="text-left text-[11px] text-dg-error bg-dg-bg border border-dg-border rounded-dg p-3 overflow-x-auto whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={this.handleReload} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Recargar
            </button>
            <button onClick={this.handleGoHome} className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <Home className="w-4 h-4" aria-hidden="true" />
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
