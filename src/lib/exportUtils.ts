import { toCsvCell } from "./sanitize";

/**
 * Exporta un arreglo de objetos a un archivo CSV.
 *
 * Los valores se pasan por `toCsvCell`, que además de escapar comillas
 * neutraliza la inyección de fórmulas: una celda que empiece por `=`, `+`,
 * `-` o `@` sería ejecutada por Excel al abrir el archivo.
 *
 * @param data Arreglo de objetos (ej. Eventos del historial)
 * @param filename Nombre del archivo a descargar (incluir .csv)
 * @returns `true` si se generó la descarga, `false` si no había datos.
 */
export function exportToCSV<T extends object>(data: T[], filename: string): boolean {
  if (!data || data.length === 0) return false;

  // Extraer cabeceras (keys) del primer objeto
  const headers = Object.keys(data[0]);

  const csvRows = [
    headers.map(toCsvCell).join(","),
    ...data.map((row) =>
      headers.map((header) => toCsvCell((row as Record<string, unknown>)[header])).join(",")
    ),
  ];

  // uFEFF = BOM para que Excel detecte UTF-8
  const blob = new Blob(["﻿" + csvRows.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Liberar el blob: sin esto queda retenido en memoria hasta recargar.
  URL.revokeObjectURL(url);

  return true;
}
