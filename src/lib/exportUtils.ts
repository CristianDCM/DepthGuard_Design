/**
 * Exporta un arreglo de objetos a un archivo CSV.
 * @param data Arreglo de objetos (ej. Eventos del historial)
 * @param filename Nombre del archivo a descargar (incluir .csv)
 */
export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert("No hay datos para exportar.");
    return;
  }

  // Extraer cabeceras (keys) del primer objeto
  const headers = Object.keys(data[0]);

  // Construir el contenido CSV
  const csvRows = [];
  
  // Fila de cabeceras
  csvRows.push(headers.join(","));

  // Filas de datos
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      // Si el valor es un objeto (ej. metricas_json), serializarlo a string
      if (val !== null && typeof val === "object") {
        return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      }
      // Escapar comillas dobles y comas envolviendo en comillas
      const valStr = String(val ?? "");
      return `"${valStr.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }

  const csvContent = csvRows.join("\n");
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }); // uFEFF = BOM para Excel (UTF-8)
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
