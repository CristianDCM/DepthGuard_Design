/**
 * Frescura del dato.
 *
 * El panel se refresca por sondeo (`getEstadoSistema` cada 30 s) y hasta ahora
 * los fallos se tragaban en silencio:
 *
 *     } catch { /* silenciar *​/ }
 *
 * Si el backend se caía, la interfaz conservaba el último estado bueno
 * indefinidamente: la píldora seguía diciendo "EN LÍNEA", en verde, sobre
 * datos muertos. En un sistema de seguridad eso es peor que un error, porque
 * produce falsa confianza: alguien decide sobre una foto de hace media hora
 * creyendo que es de ahora.
 *
 * Aquí no se decide "hay error o no", sino "cuánto hace que esto es verdad",
 * que es lo que de verdad necesita saber un operador.
 */

export type NivelFrescura = "fresco" | "retrasado" | "obsoleto";

export interface EstadoFrescura {
  nivel: NivelFrescura;
  /** Texto corto listo para pintar. */
  texto: string;
  /** A partir de aquí el contenido se atenúa: no es fiable. */
  atenuar: boolean;
}

/**
 * Los umbrales se derivan del intervalo de sondeo, no son fijos.
 *
 * Un dato de hace 40 s es normal si se sondea cada 30 s y alarmante si se
 * sondea cada 2 s. Fijar "10 segundos" para todo daría avisos constantes en
 * el heartbeat y ninguno en el preview.
 */
export const FACTOR_RETRASO = 1.6;
export const FACTOR_OBSOLETO = 3;

export function formatearAntiguedad(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `hace ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return `hace ${h} h`;
}

/**
 * @param msDesdeExito  Tiempo desde la última respuesta CORRECTA. La última
 *                      petición intentada no vale: lo que importa es cuándo
 *                      se supo algo cierto por última vez.
 * @param intervaloMs   Cada cuánto se sondea.
 * @param horaExito     Marca de tiempo del último acierto, para poder decir
 *                      la hora exacta cuando el dato ya es viejo.
 */
export function evaluarFrescura(
  msDesdeExito: number,
  intervaloMs: number,
  horaExito: number | null = null
): EstadoFrescura {
  const retraso = intervaloMs * FACTOR_RETRASO;
  const obsoleto = intervaloMs * FACTOR_OBSOLETO;

  if (msDesdeExito < retraso) {
    return { nivel: "fresco", texto: "En directo", atenuar: false };
  }

  if (msDesdeExito < obsoleto) {
    return {
      nivel: "retrasado",
      texto: `Actualizado ${formatearAntiguedad(msDesdeExito)}`,
      atenuar: false,
    };
  }

  // Con el dato ya viejo damos la hora exacta, no un "hace mucho": el
  // operador necesita poder decir "lo último que supimos fue a las 14:02".
  const hora = horaExito
    ? new Date(horaExito).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: false })
    : null;

  return {
    nivel: "obsoleto",
    texto: hora ? `Sin datos desde las ${hora}` : "Sin datos",
    atenuar: true,
  };
}
