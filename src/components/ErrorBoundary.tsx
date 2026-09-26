import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home, Copy, Check } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  /** Primeras líneas de la pila de componentes: dice QUÉ pantalla falló. */
  origen: string;
  copiado: boolean;
}

/**
 * Captura errores de renderizado en cualquier punto del árbol de componentes.
 *
 * Sin esto, un error no controlado desmonta toda la aplicación y el usuario
 * se queda con una pantalla en blanco sin explicación ni forma de recuperarse.
 *
 * El detalle técnico se muestra TAMBIÉN en producción, plegado.
 *
 * Antes solo aparecía en desarrollo, y el resultado era que quien se topaba
 * con el fallo veía "Algo salió mal" y nada más: ni qué pantalla, ni qué
 * error, ni nada que poder reenviar. Un mensaje tranquilizador que no se
 * puede diagnosticar deja el fallo vivo indefinidamente, porque nadie puede
 * describirlo. Plegado no estorba a quien solo quiere seguir trabajando, y
 * está ahí para quien tiene que arreglarlo.
 *
 * Debe ser un componente de clase: React no expone todavía un equivalente
 * con hooks para getDerivedStateFromError / componentDidCatch.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, origen: "", copiado: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // console.error se conserva en el bundle de produccion (ver vite.config.ts).
    console.error("[ErrorBoundary] Error no controlado:", error, info.componentStack);
    const origen = (info.componentStack ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 3)
      .join(" ← ");
    this.setState({ origen });
  }

  /** Texto compacto que el usuario puede pegar en un mensaje a soporte. */
  private get informe(): string {
    const e = this.state.error;
    return [
      `DepthGuard — error de interfaz`,
      `Ruta:   ${typeof window !== "undefined" ? window.location.pathname : "?"}`,
      `Hora:   ${new Date().toISOString()}`,
      `Error:  ${e?.name ?? "Error"}: ${e?.message ?? "sin mensaje"}`,
      `Origen: ${this.state.origen || "desconocido"}`,
    ].join("\n");
  }

  /**
   * Recarga limpiando antes el Service Worker y sus cachés.
   *
   * Con una PWA, la causa más común de un error de render repetido es un
   * fragmento de código obsoleto servido desde el precaché tras un
   * despliegue: el índice en caché pide un archivo que ya no existe, la
   * carga diferida falla y React lanza. Un `location.reload()` a secas
   * vuelve a servirse del mismo caché y reproduce el error una y otra vez,
   * que es justo lo que hace que parezca que "sale mucho".
   *
   * Vaciando antes, la siguiente carga viene de red y el Service Worker se
   * vuelve a instalar solo. Si el fallo era otro, no se pierde nada: en el
   * precaché solo vive la aplicación, nunca datos.
   */
  private handleReload = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const nombres = await caches.keys();
        await Promise.all(nombres.map((n) => caches.delete(n)));
      }
    } catch {
      /* si no se puede limpiar, al menos recargamos */
    }
    window.location.reload();
  };
  private handleGoHome = () => { window.location.href = "/dashboard"; };

  private handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(this.informe);
      this.setState({ copiado: true });
      setTimeout(() => this.setState({ copiado: false }), 2000);
    } catch {
      /* el portapapeles puede estar bloqueado: el texto sigue siendo seleccionable */
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-dg-bg flex items-center justify-center p-4">
        <div className="card w-full max-w-lg space-y-5 p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-dg-error/50">
              <AlertTriangle className="w-8 h-8 text-dg-error" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-bold uppercase tracking-[0.8px] text-dg-text">Algo salió mal</h1>
              <p className="text-sm text-dg-text-secondary leading-relaxed">
                La aplicación encontró un error inesperado. Tus datos no se han
                visto afectados: puedes recargar la vista y continuar.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={this.handleReload} className="btn btn-strong flex flex-1 items-center justify-center gap-2 py-3 text-sm">
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Recargar a fondo
            </button>
            <button onClick={this.handleGoHome} className="btn flex flex-1 items-center justify-center gap-2 py-3 text-sm">
              <Home className="w-4 h-4" aria-hidden="true" />
              Ir al inicio
            </button>
          </div>

          <details className="border border-dg-border">
            <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-dg-text-secondary select-none">
              Detalles técnicos
            </summary>
            <div className="space-y-3 border-t border-dg-border px-4 py-3">
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-2xs leading-relaxed text-dg-text-muted">
                {this.informe}
              </pre>
              <button
                onClick={this.handleCopy}
                className="btn inline-flex items-center gap-1.5 px-2.5 py-1.5 text-2xs"
              >
                {this.state.copiado ? (
                  <><Check className="h-3 w-3 text-dg-success" aria-hidden="true" /> Copiado</>
                ) : (
                  <><Copy className="h-3 w-3" aria-hidden="true" /> Copiar para soporte</>
                )}
              </button>
            </div>
          </details>
        </div>
      </div>
    );
  }
}
