/**
 * Aviso sonoro para las alertas de fraude.
 *
 * Se genera con WebAudio en lugar de servir un fichero: son dos tonos, pesa
 * cero y no añade una petición de red ni una entrada a la CSP.
 *
 * En una sala de control el sonido no es un adorno. Una alerta que solo es
 * visual se pierde en cuanto el operador mira a otro lado, y mirar a otro
 * lado es la mayor parte de su turno.
 */

const CLAVE = "dg_alerta_sonora";

export function sonidoActivado(): boolean {
  try {
    // Por defecto apagado: un panel que empieza a pitar sin avisar se
    // silencia para siempre a los cinco minutos.
    return localStorage.getItem(CLAVE) === "1";
  } catch {
    return false;
  }
}

export function activarSonido(activo: boolean): void {
  try {
    localStorage.setItem(CLAVE, activo ? "1" : "0");
  } catch {
    /* modo privado o almacenamiento bloqueado: la preferencia no persiste */
  }
}

type ContextoAudio = typeof AudioContext;

function crearContexto(): AudioContext | null {
  const w = window as unknown as { AudioContext?: ContextoAudio; webkitAudioContext?: ContextoAudio };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

/**
 * Dos tonos descendentes, 320 ms en total. Suena solo si la preferencia está
 * activada. Nunca lanza: un fallo de audio no puede tumbar el monitor.
 */
export function sonarAlerta(): void {
  if (!sonidoActivado()) return;
  try {
    const ctx = crearContexto();
    if (!ctx) return;

    const ahora = ctx.currentTime;
    [
      { f: 880, t: 0 },
      { f: 660, t: 0.16 },
    ].forEach(({ f, t }) => {
      const osc = ctx.createOscillator();
      const gan = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      // Rampa suave: un tono a volumen pleno desde el primer instante
      // produce un chasquido desagradable.
      gan.gain.setValueAtTime(0, ahora + t);
      gan.gain.linearRampToValueAtTime(0.18, ahora + t + 0.02);
      gan.gain.exponentialRampToValueAtTime(0.001, ahora + t + 0.15);
      osc.connect(gan).connect(ctx.destination);
      osc.start(ahora + t);
      osc.stop(ahora + t + 0.16);
    });

    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    /* el navegador puede bloquear el audio sin interaccion previa */
  }
}
