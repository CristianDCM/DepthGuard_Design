/**
 * Lectura de la calidad de captura que publica el edge durante un registro.
 *
 * CONTRATO CON EL EDGE
 * --------------------
 * `comandos_edge.resultado` es un `Record<string, any>` de formato libre. Para
 * que la guia en vivo funcione, el edge debe escribir en el, mientras el
 * comando esta `en_progreso`, un objeto con esta forma:
 *
 *   resultado: {
 *     calidad: {
 *       pixeles_validos: number,  // 0..1  — proporcion de pixeles con
 *                                 //         profundidad valida en el rostro
 *       distancia: number,        // cm    — distancia del rostro al sensor
 *       centrado: number          // 0..1  — 1 = rostro centrado en el encuadre
 *     }
 *   }
 *
 * Son las mismas magnitudes que el edge ya calcula y guarda en
 * `historial.metricas_json` al cerrar un evento. La diferencia es CUANDO se
 * publican: hoy solo existen despues, como autopsia, que es precisamente
 * cuando ya no sirven para que la persona corrija su postura.
 *
 * Mientras el edge no publique este bloque, `leerCalidad` devuelve null y la
 * interfaz no muestra la tira de calidad. Es deliberado: un indicador de
 * iluminacion inventado es peor que no tener indicador, porque la persona
 * corrige en la direccion equivocada y culpa al sistema.
 */

export interface CalidadCaptura {
  /** Proporcion de pixeles con profundidad valida, 0..1. Baja con poca luz. */
  pixelesValidos: number;
  /** Distancia del rostro al sensor, en centimetros. */
  distanciaCm: number;
  /** Centrado del rostro en el encuadre, 0..1. */
  centrado: number;
}

/** Rango util de distancia al sensor, en centimetros. */
export const DISTANCIA_MIN_CM = 40;
export const DISTANCIA_MAX_CM = 90;

type Nivel = "ok" | "aviso" | "malo";

export interface IndicadorCalidad {
  id: "luz" | "distancia" | "encuadre";
  etiqueta: string;
  /** Que tiene que hacer la persona. Vacio cuando ya esta bien. */
  consejo: string;
  nivel: Nivel;
}

function esNumeroFinito(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Extrae la calidad del `resultado` del comando, si el edge la publica.
 * Devuelve null cuando falta o viene incompleta: preferimos no pintar la tira
 * antes que pintarla con ceros, que se leerian como "todo va fatal".
 */
export function leerCalidad(resultado: unknown): CalidadCaptura | null {
  if (!resultado || typeof resultado !== "object") return null;
  const bruto = (resultado as Record<string, unknown>).calidad;
  if (!bruto || typeof bruto !== "object") return null;

  const c = bruto as Record<string, unknown>;
  if (!esNumeroFinito(c.pixeles_validos)) return null;
  if (!esNumeroFinito(c.distancia)) return null;

  return {
    pixelesValidos: Math.min(Math.max(c.pixeles_validos, 0), 1),
    distanciaCm: c.distancia,
    // El centrado es opcional: si el edge no lo manda, no penalizamos.
    centrado: esNumeroFinito(c.centrado) ? Math.min(Math.max(c.centrado, 0), 1) : 1,
  };
}

/**
 * Traduce la calidad a tres indicadores accionables. Cada uno dice que hacer,
 * no que numero tiene: "acerquese" sirve; "distancia 112 cm" no.
 */
export function indicadores(c: CalidadCaptura): IndicadorCalidad[] {
  const luz: IndicadorCalidad =
    c.pixelesValidos >= 0.6
      ? { id: "luz", etiqueta: "Iluminación", consejo: "", nivel: "ok" }
      : c.pixelesValidos >= 0.35
        ? { id: "luz", etiqueta: "Iluminación", consejo: "Hay poca luz", nivel: "aviso" }
        : { id: "luz", etiqueta: "Iluminación", consejo: "Encienda la luz", nivel: "malo" };

  const distancia: IndicadorCalidad =
    c.distanciaCm > DISTANCIA_MAX_CM
      ? { id: "distancia", etiqueta: "Distancia", consejo: "Acérquese", nivel: c.distanciaCm > DISTANCIA_MAX_CM + 30 ? "malo" : "aviso" }
      : c.distanciaCm < DISTANCIA_MIN_CM
        ? { id: "distancia", etiqueta: "Distancia", consejo: "Aléjese un poco", nivel: c.distanciaCm < DISTANCIA_MIN_CM - 12 ? "malo" : "aviso" }
        : { id: "distancia", etiqueta: "Distancia", consejo: "", nivel: "ok" };

  const encuadre: IndicadorCalidad =
    c.centrado >= 0.7
      ? { id: "encuadre", etiqueta: "Encuadre", consejo: "", nivel: "ok" }
      : c.centrado >= 0.45
        ? { id: "encuadre", etiqueta: "Encuadre", consejo: "Centre el rostro", nivel: "aviso" }
        : { id: "encuadre", etiqueta: "Encuadre", consejo: "Colóquese en el óvalo", nivel: "malo" };

  return [luz, distancia, encuadre];
}

/**
 * El consejo mas urgente, para anunciarlo junto a la instruccion de pose.
 * Null cuando no hay nada que corregir.
 */
export function consejoPrioritario(c: CalidadCaptura | null): string | null {
  if (!c) return null;
  const lista = indicadores(c).filter((i) => i.consejo);
  if (lista.length === 0) return null;
  const malo = lista.find((i) => i.nivel === "malo");
  return (malo ?? lista[0]).consejo;
}
