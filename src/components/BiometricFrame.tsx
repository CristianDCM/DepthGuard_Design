import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { indicadores, type CalidadCaptura } from "../lib/calidadCaptura";

/**
 * Marco de captura biométrica.
 *
 * Es lo que faltaba: hasta ahora el registro facial mostraba un <video>
 * desnudo sobre fondo negro, sin óvalo, sin máscara, sin anillo de progreso y
 * sin una sola indicación de dónde debía colocarse la persona. Las
 * instrucciones de pose existían en el código desde el primer commit y no se
 * renderizaban en ningún sitio.
 *
 * Cada elemento responde a una pregunta concreta de quien está siendo
 * escaneado, y no se dibuja nada que no responda a ninguna:
 *
 *   ¿dónde me pongo?          → máscara con óvalo recortado
 *   ¿me está viendo?          → color del anillo
 *   ¿qué tengo que hacer?     → instrucción de pose y flecha direccional
 *   ¿cuánto queda?            → anillo de progreso y puntos de ángulo
 *   ¿por qué está fallando?   → tira de calidad (luz, distancia, encuadre)
 *
 * Se han retirado el barrido de escaneo, las esquinas de visor y el
 * resplandor del anillo: eran decoración de película de espías encima de la
 * cara de alguien que solo intenta seguir una instrucción.
 */

export type EstadoMarco =
  | "esperando"   // aún no hay vídeo
  | "buscando"    // hay vídeo, no hay rostro localizado
  | "colocando"   // rostro detectado pero mal encuadrado
  | "capturando"  // capturando un ángulo
  | "correcto"    // ángulo aceptado
  | "fallido";    // el intento se ha rechazado

export type Pose = "frontal" | "izquierda" | "derecha" | "arriba" | "abajo";

interface Props {
  estado: EstadoMarco;
  /** Texto literal de lo que debe hacer la persona. */
  instruccion: string;
  pose: Pose;
  /** 0..1 — proporción de ángulos ya capturados. */
  progreso: number;
  angulosHechos: number;
  angulosTotal: number;
  /** Solo si el edge la publica; si no, la tira no se dibuja. */
  calidad?: CalidadCaptura | null;
  /**
   * Voltea el preview horizontalmente, como un espejo.
   *
   * No es cosmetico: de ello depende que la flecha de pose sea correcta. La
   * camara del terminal NO esta espejada, asi que en su imagen cruda, cuando
   * alguien gira la cabeza a SU izquierda, la cara se mueve hacia la derecha
   * de la pantalla y una flecha a la izquierda le estaria mintiendo.
   *
   * Espejando el preview la relacion vuelve a ser la de un espejo, que es la
   * que cualquiera interpreta sin pensar, y la flecha pasa a ser correcta por
   * construccion. Solo afecta a lo que se ve: la captura y el calculo de la
   * plantilla ocurren en el terminal, sobre la imagen sin voltear.
   */
  espejo?: boolean;
  /** El reproductor de vídeo. */
  children: ReactNode;
}

const COLOR_ESTADO: Record<EstadoMarco, string> = {
  esperando: "var(--color-dg-text-off)",
  buscando: "var(--color-dg-text-off)",
  colocando: "var(--color-dg-warning)",
  capturando: "var(--color-dg-info)",
  correcto: "var(--color-dg-success)",
  fallido: "var(--color-dg-error)",
};

const CHEVRON: Record<Pose, typeof ChevronLeft | null> = {
  frontal: null,
  izquierda: ChevronLeft,
  derecha: ChevronRight,
  arriba: ChevronUp,
  abajo: ChevronDown,
};

/** Posición de la flecha respecto al óvalo. */
const CHEVRON_POS: Record<Pose, string> = {
  frontal: "",
  izquierda: "left-0 top-1/2 -translate-y-1/2 -translate-x-1/2",
  derecha: "right-0 top-1/2 -translate-y-1/2 translate-x-1/2",
  arriba: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
  abajo: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
};

export default function BiometricFrame({
  estado,
  instruccion,
  pose,
  progreso,
  angulosHechos,
  angulosTotal,
  calidad,
  espejo = true,
  children,
}: Props) {
  const color = COLOR_ESTADO[estado];
  const Chevron = CHEVRON[pose];
  const progresoAcotado = Math.min(Math.max(progreso, 0), 1);
  const tira = calidad ? indicadores(calidad) : null;

  return (
    <div className="space-y-4">
      <div className="relative mx-auto w-full max-w-md overflow-hidden border border-dg-border bg-dg-canvas aspect-[3/4] sm:aspect-video">
        {/* Vídeo, ocupando todo el marco */}
        <div
          className={`absolute inset-0 [&_video]:h-full [&_video]:w-full [&_video]:object-cover ${
            espejo ? "[&_video]:-scale-x-100" : ""
          }`}
        >
          {children}
        </div>

        {/*
          Máscara de enfoque. El óvalo no se dibuja: se recorta. Un
          box-shadow enorme oscurece todo lo que queda fuera, así que la cara
          de la persona es la única zona nítida de la pantalla y el encuadre
          se entiende sin una sola palabra.
        */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[46%] w-[62%] max-w-[240px] aspect-[3/4] -translate-x-1/2 -translate-y-1/2"
        >
          <div className="absolute inset-0 rounded-[50%] shadow-[0_0_0_9999px_rgb(8_11_18_/_0.72)]" />

          {/* Anillo de progreso: cada ángulo capturado avanza un tramo */}
          <svg viewBox="0 0 300 400" className="absolute inset-0 h-full w-full overflow-visible">
            <ellipse
              cx="150" cy="200" rx="147" ry="197"
              fill="none"
              stroke={color}
              strokeOpacity={0.35}
              strokeWidth="2"
            />
            {/*
              El arco empieza a las 12 en punto, no a las 3, que es donde
              arranca el trazado de una elipse en SVG.

              NO se consigue con transform="rotate(-90)": en una elipse eso
              gira la FIGURA, no la fase, y convierte un ovalo alto en uno
              ancho. El anillo quedaba con el ancho y el alto intercambiados
              (309x231 sobre un ovalo de 231x309) y no seguia el borde.

              Con pathLength normalizado a 1, las 12 en punto caen justo en
              el 75% del recorrido, asi que basta con desplazar el patron de
              guiones hasta ahi.
            */}
            <ellipse
              cx="150" cy="200" rx="147" ry="197"
              fill="none"
              stroke={color}
              strokeWidth="4"
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={`${progresoAcotado} ${Math.max(1 - progresoAcotado, 0.0001)}`}
              strokeDashoffset={-0.75}
            />
          </svg>

          {/* Flecha hacia donde debe girar la cara */}
          {Chevron && (
            <div className={`absolute ${CHEVRON_POS[pose]} bg-dg-bg/80 p-1`}>
              <Chevron className="h-4 w-4" style={{ color }} aria-hidden="true" />
            </div>
          )}
        </div>

      </div>

      {/*
        Instrucción de pose. aria-live la anuncia también por lector de
        pantalla, que es justo lo que necesita alguien que no puede mirar el
        móvil mientras gira la cara.
      */}
      <div className="space-y-1.5 text-center" aria-live="assertive">
        <p className="text-lg font-semibold leading-snug text-dg-text">{instruccion}</p>
        <p className="text-xs text-dg-text-secondary tabular">
          Ángulo {Math.min(angulosHechos + 1, angulosTotal)} de {angulosTotal}
        </p>
      </div>

      {/* Puntos de ángulo: vacío → en curso → capturado */}
      <ol
        className="flex items-center justify-center gap-2"
        aria-label={`${angulosHechos} de ${angulosTotal} ángulos capturados`}
      >
        {Array.from({ length: angulosTotal }, (_, i) => {
          const hecho = i < angulosHechos;
          const enCurso = i === angulosHechos;
          return (
            <li
              key={i}
              aria-hidden="true"
              className={`h-1.5 ${
                hecho
                  ? "w-8 bg-dg-success"
                  : enCurso
                    ? "w-8 bg-dg-info"
                    : "w-4 bg-dg-border"
              }`}
            />
          );
        })}
      </ol>

      {/*
        Tira de calidad. Solo aparece si el edge publica las medidas: ver el
        contrato en src/lib/calidadCaptura.ts. Un indicador de iluminación
        inventado sería peor que ninguno, porque la persona corregiría en la
        dirección equivocada.
      */}
      {tira && (
        <ul className="grid grid-cols-3 gap-2">
          {tira.map((ind) => (
            <li
              key={ind.id}
              className={`flex flex-col items-center gap-1 border px-2 py-2 text-center ${
                ind.nivel === "ok"
                  ? "border-dg-success/40"
                  : ind.nivel === "aviso"
                    ? "border-dg-warning/50"
                    : "border-dg-error/50"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 ${
                  ind.nivel === "ok" ? "bg-dg-success" : ind.nivel === "aviso" ? "bg-dg-warning" : "bg-dg-error"
                }`}
              />
              <span className="text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-secondary">{ind.etiqueta}</span>
              <span
                className={`text-2xs ${
                  ind.nivel === "ok" ? "text-dg-success" : ind.nivel === "aviso" ? "text-dg-warning" : "text-dg-error"
                }`}
              >
                {ind.consejo || "Correcta"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
