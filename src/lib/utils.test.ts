import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("concatena clases sueltas", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("descarta los valores condicionales falsos", () => {
    expect(cn("base", false && "oculto", null, undefined, "visible")).toBe(
      "base visible"
    );
  });

  it("resuelve conflictos de Tailwind quedándose con la última clase", () => {
    // Es la razón de ser del helper: sin twMerge las dos clases acabarían en
    // el DOM y ganaría la que el CSS defina más tarde, no la que se pasa.
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-dg-text-muted", "text-dg-accent")).toBe("text-dg-accent");
  });

  it("permite sobreescribir estilos desde una prop className", () => {
    expect(cn("cyber-card p-4", "p-6")).toBe("cyber-card p-6");
  });
});
