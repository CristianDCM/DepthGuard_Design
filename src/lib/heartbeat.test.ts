import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isEdgeOnline,
  isCamaraActiva,
  EDGE_HEARTBEAT_TIMEOUT_MS,
  type CamaraEstado,
} from "./supabase";

/** Construye un heartbeat situado a N milisegundos en el pasado. */
function heartbeatHace(ms: number): string {
  return new Date(Date.now() - ms).toISOString();
}

const camara: CamaraEstado = {
  camera_id: "entrada_principal",
  camera_type: "3D",
  modelo: "Intel RealSense D435",
  activa: true,
};

describe("isEdgeOnline", () => {
  beforeEach(() => {
    // Reloj fijo: sin esto la prueba del límite exacto sería intermitente.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("considera offline al edge que nunca ha enviado heartbeat", () => {
    expect(isEdgeOnline(null)).toBe(false);
  });

  it("considera online un heartbeat reciente", () => {
    expect(isEdgeOnline(heartbeatHace(5_000))).toBe(true);
  });

  it("considera online justo por debajo del tiempo límite", () => {
    expect(isEdgeOnline(heartbeatHace(EDGE_HEARTBEAT_TIMEOUT_MS - 1_000))).toBe(true);
  });

  it("considera offline al alcanzar exactamente el tiempo límite", () => {
    expect(isEdgeOnline(heartbeatHace(EDGE_HEARTBEAT_TIMEOUT_MS))).toBe(false);
  });

  it("considera offline un heartbeat vencido", () => {
    expect(isEdgeOnline(heartbeatHace(10 * 60_000))).toBe(false);
  });

  it("considera offline una marca de tiempo inválida", () => {
    expect(isEdgeOnline("no es una fecha")).toBe(false);
  });
});

describe("isCamaraActiva", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-13T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("respeta el estado reportado cuando el edge está online", () => {
    expect(isCamaraActiva(camara, heartbeatHace(1_000))).toBe(true);
    expect(isCamaraActiva({ ...camara, activa: false }, heartbeatHace(1_000))).toBe(false);
  });

  it("nunca reporta una cámara activa si el edge está offline", () => {
    // Regla de seguridad: una cámara no puede estar vigilando si el nodo
    // que la controla lleva dos minutos sin dar señales, por mucho que el
    // último heartbeat conocido dijera que estaba encendida.
    expect(isCamaraActiva(camara, heartbeatHace(10 * 60_000))).toBe(false);
    expect(isCamaraActiva(camara, null)).toBe(false);
  });
});
