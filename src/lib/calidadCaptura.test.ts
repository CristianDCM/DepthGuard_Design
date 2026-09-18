import { describe, it, expect } from "vitest";
import {
  leerCalidad,
  indicadores,
  consejoPrioritario,
  DISTANCIA_MIN_CM,
  DISTANCIA_MAX_CM,
  type CalidadCaptura,
} from "./calidadCaptura";

const buena: CalidadCaptura = { pixelesValidos: 0.9, distanciaCm: 60, centrado: 0.95 };

describe("leerCalidad", () => {
  it("devuelve null cuando el edge no publica el bloque de calidad", () => {
    // Es el caso de HOY: el edge escribe en `resultado` lo que quiere y no
    // hay contrato previo. Sin datos preferimos no pintar la tira antes que
    // pintarla con ceros, que se leerian como "todo va fatal".
    expect(leerCalidad(undefined)).toBeNull();
    expect(leerCalidad(null)).toBeNull();
    expect(leerCalidad({})).toBeNull();
    expect(leerCalidad({ calidad: null })).toBeNull();
    expect(leerCalidad("no soy un objeto")).toBeNull();
  });

  it("rechaza el bloque si falta alguna medida obligatoria", () => {
    expect(leerCalidad({ calidad: { distancia: 60 } })).toBeNull();
    expect(leerCalidad({ calidad: { pixeles_validos: 0.8 } })).toBeNull();
  });

  it("rechaza valores no finitos en lugar de propagar NaN a la interfaz", () => {
    expect(leerCalidad({ calidad: { pixeles_validos: NaN, distancia: 60 } })).toBeNull();
    expect(leerCalidad({ calidad: { pixeles_validos: 0.8, distancia: Infinity } })).toBeNull();
    expect(leerCalidad({ calidad: { pixeles_validos: "0.8", distancia: 60 } })).toBeNull();
  });

  it("lee el bloque completo y acota la proporcion de pixeles a 0..1", () => {
    expect(leerCalidad({ calidad: { pixeles_validos: 1.4, distancia: 55, centrado: 0.8 } }))
      .toEqual({ pixelesValidos: 1, distanciaCm: 55, centrado: 0.8 });
    expect(leerCalidad({ calidad: { pixeles_validos: -0.2, distancia: 55, centrado: 2 } }))
      .toEqual({ pixelesValidos: 0, distanciaCm: 55, centrado: 1 });
  });

  it("trata el centrado como opcional y no penaliza si el edge no lo manda", () => {
    expect(leerCalidad({ calidad: { pixeles_validos: 0.9, distancia: 60 } }))
      .toEqual({ pixelesValidos: 0.9, distanciaCm: 60, centrado: 1 });
  });
});

describe("indicadores", () => {
  it("no da ningun consejo cuando la captura es correcta", () => {
    expect(indicadores(buena).every((i) => i.nivel === "ok" && i.consejo === "")).toBe(true);
  });

  it("avisa de poca luz antes de declararla insuficiente", () => {
    const [luz] = indicadores({ ...buena, pixelesValidos: 0.5 });
    expect(luz.nivel).toBe("aviso");
    expect(luz.consejo).toBe("Hay poca luz");

    const [grave] = indicadores({ ...buena, pixelesValidos: 0.2 });
    expect(grave.nivel).toBe("malo");
    expect(grave.consejo).toBe("Encienda la luz");
  });

  it("distingue estar lejos de estar cerca, y dice que hacer en cada caso", () => {
    const lejos = indicadores({ ...buena, distanciaCm: DISTANCIA_MAX_CM + 10 })[1];
    expect(lejos.consejo).toBe("Acérquese");

    const cerca = indicadores({ ...buena, distanciaCm: DISTANCIA_MIN_CM - 5 })[1];
    expect(cerca.consejo).toBe("Aléjese un poco");
  });

  it("acepta los limites exactos del rango util", () => {
    expect(indicadores({ ...buena, distanciaCm: DISTANCIA_MIN_CM })[1].nivel).toBe("ok");
    expect(indicadores({ ...buena, distanciaCm: DISTANCIA_MAX_CM })[1].nivel).toBe("ok");
  });

  it("pide centrar el rostro segun lo desviado que este", () => {
    expect(indicadores({ ...buena, centrado: 0.5 })[2].consejo).toBe("Centre el rostro");
    expect(indicadores({ ...buena, centrado: 0.2 })[2].consejo).toBe("Colóquese en el óvalo");
  });
});

describe("consejoPrioritario", () => {
  it("no interrumpe la instruccion de pose cuando no hay nada que corregir", () => {
    expect(consejoPrioritario(buena)).toBeNull();
    expect(consejoPrioritario(null)).toBeNull();
  });

  it("antepone el problema grave al leve", () => {
    // Luz solo en aviso, encuadre grave: manda el encuadre.
    const c: CalidadCaptura = { pixelesValidos: 0.5, distanciaCm: 60, centrado: 0.2 };
    expect(consejoPrioritario(c)).toBe("Colóquese en el óvalo");
  });

  it("con varios avisos del mismo nivel respeta el orden luz, distancia, encuadre", () => {
    const c: CalidadCaptura = { pixelesValidos: 0.5, distanciaCm: DISTANCIA_MAX_CM + 5, centrado: 0.5 };
    expect(consejoPrioritario(c)).toBe("Hay poca luz");
  });
});
