import { describe, it, expect } from "vitest";
import { evaluarFrescura, formatearAntiguedad, FACTOR_RETRASO, FACTOR_OBSOLETO } from "./frescura";

const SONDEO = 30_000; // el heartbeat del monitor

describe("evaluarFrescura", () => {
  it("considera fresco lo que llega dentro del ritmo de sondeo", () => {
    expect(evaluarFrescura(0, SONDEO).nivel).toBe("fresco");
    expect(evaluarFrescura(SONDEO, SONDEO).nivel).toBe("fresco");
    expect(evaluarFrescura(SONDEO * FACTOR_RETRASO - 1, SONDEO).nivel).toBe("fresco");
  });

  it("avisa cuando se salta un sondeo, sin atenuar todavia", () => {
    const e = evaluarFrescura(SONDEO * 2, SONDEO);
    expect(e.nivel).toBe("retrasado");
    expect(e.atenuar).toBe(false);
    expect(e.texto).toContain("hace");
  });

  it("declara el dato obsoleto y pide atenuarlo", () => {
    // Este es el caso que antes no existia: el backend caido dejaba la
    // pildora en verde diciendo "EN LINEA" sobre datos muertos.
    const e = evaluarFrescura(SONDEO * FACTOR_OBSOLETO, SONDEO);
    expect(e.nivel).toBe("obsoleto");
    expect(e.atenuar).toBe(true);
  });

  it("da la hora exacta del ultimo acierto cuando el dato ya es viejo", () => {
    const hora = new Date("2026-09-18T14:02:00").getTime();
    const e = evaluarFrescura(10 * 60_000, SONDEO, hora);
    expect(e.texto).toContain("14:02");
  });

  it("escala los umbrales con el intervalo en lugar de fijarlos", () => {
    // La misma antiguedad significa cosas distintas segun el ritmo: 50 s
    // sondeando cada 30 s es un sondeo perdido; sondeando cada 2 s, el dato
    // lleva veinticinco ciclos muerto.
    expect(evaluarFrescura(50_000, SONDEO).nivel).toBe("retrasado");
    expect(evaluarFrescura(50_000, 2_000).nivel).toBe("obsoleto");

    // Y 40 s con sondeo de 30 s sigue siendo normal: hay que dejar margen a
    // una respuesta lenta antes de empezar a alarmar.
    expect(evaluarFrescura(40_000, SONDEO).nivel).toBe("fresco");
  });
});

describe("formatearAntiguedad", () => {
  it("cambia de unidad al cruzar cada umbral", () => {
    expect(formatearAntiguedad(5_000)).toBe("hace 5 s");
    expect(formatearAntiguedad(59_999)).toBe("hace 59 s");
    expect(formatearAntiguedad(60_000)).toBe("hace 1 min");
    expect(formatearAntiguedad(59 * 60_000)).toBe("hace 59 min");
    expect(formatearAntiguedad(60 * 60_000)).toBe("hace 1 h");
  });
});
