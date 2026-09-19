import { useEffect } from "react";

/**
 * Fija el lienzo de la pagina: el documento deja de desplazarse y son los
 * contenedores internos los que ruedan.
 *
 * Hace falta hacerlo en `html` y `body`, no basta con acotar el contenedor
 * raiz de la pantalla. Aun teniendo toda la cadena de ancestros con altura
 * fija y `overflow:hidden`, el documento seguia generando area de
 * desplazamiento a partir del tamano intrinseco de la tabla, y la pagina se
 * podia arrastrar varios miles de pixeles hacia ESPACIO EN BLANCO: el
 * contenido quedaba recortado arriba y debajo no habia nada.
 *
 * Se usa `dvh` para el alto: en movil, `vh` cuenta la barra del navegador
 * incluso cuando esta desplegada y deja un trozo del contenido fuera.
 */
export function usePantallaFija(activo = true) {
  useEffect(() => {
    if (!activo) return;
    const raiz = document.documentElement;
    raiz.classList.add("pantalla-fija");
    return () => raiz.classList.remove("pantalla-fija");
  }, [activo]);
}
