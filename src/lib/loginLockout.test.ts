import { describe, it, expect } from "vitest";
import { getLockoutSeconds, LOCKOUT_THRESHOLDS } from "./loginLockout";

describe("getLockoutSeconds", () => {
  it("no bloquea por debajo del primer umbral", () => {
    expect(getLockoutSeconds(0)).toBe(0);
    expect(getLockoutSeconds(2)).toBe(0);
  });

  it("aplica cada umbral en su intento exacto", () => {
    expect(getLockoutSeconds(3)).toBe(30);
    expect(getLockoutSeconds(5)).toBe(120);
    expect(getLockoutSeconds(7)).toBe(300);
    expect(getLockoutSeconds(10)).toBe(600);
  });

  it("mantiene el umbral anterior entre escalones", () => {
    expect(getLockoutSeconds(4)).toBe(30);
    expect(getLockoutSeconds(6)).toBe(120);
    expect(getLockoutSeconds(9)).toBe(300);
  });

  it("no se relaja al acumular más intentos de los previstos", () => {
    expect(getLockoutSeconds(50)).toBe(600);
    expect(getLockoutSeconds(1000)).toBe(600);
  });

  it("crece de forma monótona en todo el recorrido", () => {
    // Propiedad central del control: un intento más nunca puede reducir
    // el tiempo de bloqueo.
    let anterior = 0;
    for (let intentos = 0; intentos <= 20; intentos++) {
      const actual = getLockoutSeconds(intentos);
      expect(actual).toBeGreaterThanOrEqual(anterior);
      anterior = actual;
    }
  });

  it("define los umbrales en orden ascendente de intentos y de castigo", () => {
    for (let i = 1; i < LOCKOUT_THRESHOLDS.length; i++) {
      expect(LOCKOUT_THRESHOLDS[i][0]).toBeGreaterThan(LOCKOUT_THRESHOLDS[i - 1][0]);
      expect(LOCKOUT_THRESHOLDS[i][1]).toBeGreaterThan(LOCKOUT_THRESHOLDS[i - 1][1]);
    }
  });
});
