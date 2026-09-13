// src/lib/loginLockout.ts
// Política de bloqueo progresivo tras intentos de acceso fallidos.
//
// Vive aparte de la pantalla de Login para poder verificarse con pruebas
// unitarias: es un control de seguridad, no un detalle de presentación.

/** Umbrales de bloqueo progresivo: [intentos, segundos de bloqueo] */
export const LOCKOUT_THRESHOLDS: readonly (readonly [number, number])[] = [
  [3, 30],   // 3 intentos fallidos → 30 s de bloqueo
  [5, 120],  // 5 intentos → 2 minutos
  [7, 300],  // 7 intentos → 5 minutos
  [10, 600], // 10 intentos → 10 minutos
] as const;

/**
 * Segundos de bloqueo que corresponden a un número de intentos fallidos.
 *
 * Devuelve el umbral más alto alcanzado, de modo que la penalización crece
 * de forma monótona y nunca se relaja al acumular más intentos.
 *
 * @param attempts Intentos fallidos acumulados en la sesión.
 * @returns Segundos de bloqueo; 0 si aún no se alcanza ningún umbral.
 */
export function getLockoutSeconds(attempts: number): number {
  let lockout = 0;
  for (const [threshold, seconds] of LOCKOUT_THRESHOLDS) {
    if (attempts >= threshold) lockout = seconds;
  }
  return lockout;
}
