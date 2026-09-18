import { describe, it, expect, afterEach, vi } from "vitest";
import { clasificar, traducirError, ERRORES } from "./errores";

/** Fabrica una DOMException con el nombre que usa el navegador. */
function domError(name: string) {
  const e = new Error("mensaje irrelevante");
  e.name = name;
  return e;
}

afterEach(() => vi.unstubAllGlobals());

describe("clasificar", () => {
  it("distingue los tres fallos de camara, que hoy se mostraban todos igual", () => {
    // El WebRTCPlayer colapsaba permiso denegado, sensor ausente y camara
    // ocupada en un unico "WebRTC no disponible", sin poder diagnosticar.
    expect(clasificar(domError("NotAllowedError"))).toBe("CAMARA_DENEGADA");
    expect(clasificar(domError("NotFoundError"))).toBe("CAMARA_NO_ENCONTRADA");
    expect(clasificar(domError("NotReadableError"))).toBe("CAMARA_OCUPADA");
  });

  it("acepta tambien los nombres antiguos de las mismas excepciones", () => {
    expect(clasificar(domError("PermissionDeniedError"))).toBe("CAMARA_DENEGADA");
    expect(clasificar(domError("DevicesNotFoundError"))).toBe("CAMARA_NO_ENCONTRADA");
    expect(clasificar(domError("TrackStartError"))).toBe("CAMARA_OCUPADA");
  });

  it("detecta que el dispositivo no tiene red antes de culpar al servidor", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(clasificar(new Error("cualquier cosa"))).toBe("SIN_CONEXION");
  });

  it("reconoce un fetch fallido como servidor inalcanzable", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(clasificar(new TypeError("Failed to fetch"))).toBe("SERVIDOR_NO_RESPONDE");
    expect(clasificar(new TypeError("NetworkError when attempting to fetch"))).toBe("SERVIDOR_NO_RESPONDE");
  });

  it("traduce los codigos de Postgres y PostgREST", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(clasificar({ code: "23505", message: "duplicate key value" })).toBe("USUARIO_DUPLICADO");
    expect(clasificar({ code: "42501", message: "permission denied for table" })).toBe("SIN_PERMISOS");
    expect(clasificar({ code: "PGRST301", message: "JWT expired" })).toBe("SESION_CADUCADA");
  });

  it("reconoce la violacion de RLS por el texto cuando no viene el codigo", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(clasificar(new Error("new row violates row-level security policy"))).toBe("SIN_PERMISOS");
  });

  it("cae en DESCONOCIDO sin romperse ante cualquier basura", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(clasificar(null)).toBe("DESCONOCIDO");
    expect(clasificar(undefined)).toBe("DESCONOCIDO");
    expect(clasificar(42)).toBe("DESCONOCIDO");
    expect(clasificar({ message: 123 })).toBe("DESCONOCIDO");
    expect(clasificar(new Error("algo rarisimo"))).toBe("DESCONOCIDO");
  });
});

describe("traducirError", () => {
  it("nunca devuelve el texto crudo del error", () => {
    vi.stubGlobal("navigator", { onLine: true });
    const ui = traducirError(new Error("TypeError: cannot read properties of null"));
    expect(ui.titulo).not.toContain("TypeError");
    expect(ui.cuerpo).not.toContain("null");
  });

  it("da un codigo con el prefijo del contexto, para soporte", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(traducirError(domError("NotAllowedError"), { contexto: "camara" }).codigo).toMatch(/^DG-CAM-\d\d$/);
    expect(traducirError(new Error("x"), { contexto: "datos" }).codigo).toMatch(/^DG-NET-\d\d$/);
    expect(traducirError(new Error("x")).codigo).toMatch(/^DG-\d\d$/);
  });

  it("permite forzar la entrada cuando quien llama ya sabe que ha pasado", () => {
    const ui = traducirError(null, { clave: "EDGE_APAGADO", contexto: "datos" });
    expect(ui.titulo).toBe("El terminal de acceso está apagado");
    expect(ui.severidad).toBe("critico");
  });

  it("todas las entradas del catalogo dicen que hacer o por que no se puede", () => {
    for (const [clave, e] of Object.entries(ERRORES)) {
      expect(e.titulo.length, clave).toBeGreaterThan(0);
      expect(e.cuerpo.length, clave).toBeGreaterThan(20);
      // SIN_PERMISOS es el unico sin accion: no hay nada que el usuario
      // pueda hacer por si mismo, y ofrecer "reintentar" seria mentirle.
      if (clave !== "SIN_PERMISOS") expect(e.acciones.length, clave).toBeGreaterThan(0);
    }
  });
});
