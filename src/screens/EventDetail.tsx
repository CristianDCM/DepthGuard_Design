import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Video, ExternalLink, Fingerprint, ShieldAlert, UserSearch, Plus, FileText, Download } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from "recharts";
import Navigation from "../components/Navigation";
import { getEventoPorId, type Evento } from "../lib/supabase";
import { escapeHtml } from "../lib/sanitize";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [errorInforme, setErrorInforme] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      if (!id) return;
      try {
        const data = await getEventoPorId(id);
        setEvento(data);
      } catch (err) {
        console.error("Error cargando evento:", err);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dg-bg">
        <p role="status" className="text-xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Cargando</p>
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dg-bg">
        <p className="text-dg-text-muted">Evento no encontrado</p>
      </div>
    );
  }

  const isAuthorized = evento.estado === "ACCESO_PERMITIDO";
  const isFraud = evento.estado === "FRAUDE";
  const isUnknown = evento.estado === "DESCONOCIDO";
  const metricas = evento.metricas_json;
  const confianzaPct = evento.confianza != null ? Math.round(evento.confianza * 100) : null;
  const headerTitle = isFraud ? "Detalle de Fraude" : "Detalle del Evento";
  /*
   * Descripcion de la evidencia para lectores de pantalla. El alt anterior
   * era la palabra "Captura", que en la unica imagen forense del sistema no
   * dice absolutamente nada de lo que hay en ella.
   */
  const estadoTexto = isFraud
    ? "intento de suplantación"
    : isUnknown
      ? "persona no registrada"
      : "acceso permitido";
  const timestamp = new Date(evento.timestamp).toLocaleString("es", { dateStyle: "short", timeStyle: "medium", hour12: true });

  // ============================================
  // Generación de informe PDF
  // ============================================

  const descargarInforme = async () => {
    if (!evento) return;
    setGenerandoPdf(true);

    try {
      // Convertir foto a base64 si existe
      let fotoBase64 = "";
      if (evento.foto_url) {
        try {
          const resp = await fetch(evento.foto_url);
          const blob = await resp.blob();
          fotoBase64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch { /* foto no disponible */ }
      }

      const htmlContent = generarHTMLInforme(evento, fotoBase64);

      // Abrir ventana de impresión
      const ventana = window.open("", "_blank", "width=800,height=1000");
      if (!ventana) {
        setErrorInforme(
          "El navegador bloqueó la ventana emergente. Permite las ventanas emergentes para este sitio y vuelve a intentarlo."
        );
        return;
      }
      setErrorInforme(null);

      ventana.document.write(htmlContent);
      ventana.document.close();

      // Esperar a que la imagen cargue antes de imprimir
      ventana.onload = () => {
        setTimeout(() => {
          ventana.print();
        }, 500);
      };
    } catch (err) {
      console.error("Error generando informe:", err);
    } finally {
      setGenerandoPdf(false);
    }
  };

  return (
    <div className="mini min-h-screen pb-24 lg:pb-0 lg:pt-16 flex flex-col">
      <header className="sticky top-0 lg:top-16 z-40 border-b border-dg-border bg-dg-bg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} aria-label="Volver a la pantalla anterior" className="text-dg-action-text hover:text-dg-text">
              <ArrowLeft className="h-6 w-6" aria-hidden="true" />
            </button>
            <h1 className="text-lg font-bold uppercase tracking-[0.8px] text-dg-text">{headerTitle}</h1>
          </div>
        </div>
      </header>

      <main id="contenido" className="px-4 py-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Image and Status */}
          <div className="lg:col-span-7 space-y-6">
            <section className="flex justify-center lg:justify-start">
              {isAuthorized && (
                <div className="flex items-center gap-2 border border-dg-success/50 px-6 py-3">
                  <span className="h-2 w-2 bg-dg-success" aria-hidden="true" />
                  <span className="text-sm font-bold uppercase tracking-[0.8px] text-dg-success">Acceso permitido</span>
                </div>
              )}
              {isFraud && (
                <div className="flex items-center gap-2 border border-dg-error/50 px-6 py-3">
                  <span className="h-2 w-2 bg-dg-error" aria-hidden="true" />
                  <span className="text-sm font-bold uppercase tracking-[0.8px] text-dg-error">Fraude detectado</span>
                </div>
              )}
              {isUnknown && (
                <div className="flex items-center gap-2 border border-dg-warning/50 px-6 py-3">
                  <span className="h-2 w-2 bg-dg-warning" aria-hidden="true" />
                  <span className="text-sm font-bold uppercase tracking-[0.8px] text-dg-warning">Persona desconocida</span>
                </div>
              )}
            </section>

            <div className={`relative overflow-hidden border border-dg-border bg-dg-canvas ${isUnknown ? 'aspect-video' : 'aspect-[4/3]'}`}>
              {isFraud && <div className="absolute inset-0 bg-dg-error/20 mix-blend-overlay z-10 pointer-events-none" />}
              {evento.foto_url ? (
                <img 
                  className={`w-full h-full object-cover opacity-80 ${!isAuthorized ? 'grayscale' : ''}`} 
                  src={evento.foto_url} 
                  alt={`Captura del momento del evento: ${estadoTexto}${evento.nombre ? `, ${evento.nombre}` : ""}, ${timestamp}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-dg-bg text-dg-text-muted">
                  <Video className="w-16 h-16 opacity-20" />
                </div>
              )}
              
              {/* Se retira el degradado sobre la foto: la hora ya va en su
                  propia caja y el degradado solo oscurecia la captura. */}
              <div className="absolute bottom-4 right-4 border border-dg-border bg-dg-bg/80 px-3 py-1.5">
                <p className="font-mono tabular text-xs text-white/90">{timestamp}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Details and Actions */}
          <div className="lg:col-span-5 space-y-6">
            {isAuthorized && evento.nombre && (
              <div className="mini-card flex items-center gap-4 p-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-dg-border text-xl font-bold text-dg-text-secondary">
                  {evento.nombre.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-grow">
                  <h3 className="text-lg font-bold text-dg-text">{evento.nombre}</h3>
                  <p className="text-dg-text-muted text-xs font-mono tabular">ID: #{evento.usuario_id?.substring(0, 8) ?? "—"}</p>
                </div>
                {evento.usuario_id && (
                  <button 
                    onClick={() => navigate(`/profile/${evento.usuario_id}`)}
                    className="flex items-center gap-1 text-xs font-bold uppercase tracking-[0.8px] text-dg-action-text hover:underline"
                  >
                    Ver Perfil <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {isFraud && (
              <div className="grid grid-cols-1 gap-4">
                <div className="mini-card flex items-center gap-5 p-6">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-dg-error/50">
                    <ShieldAlert className="h-8 w-8 text-dg-error" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold uppercase tracking-[0.8px] text-dg-text">Intento de Suplantación</h3>
                    <p className="text-dg-text-muted text-sm">Ningún usuario identificado</p>
                  </div>
                </div>

                <div className="mini-card p-6">
                  <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.8px] text-dg-error">Motivo de Detección</h4>
                  <p className="text-dg-text text-base leading-relaxed">
                    {evento.motivo ?? "Superficie plana detectada — Varianza de profundidad insuficiente para rostro real"}
                  </p>
                </div>
              </div>
            )}

            {isUnknown && (
              <>
                <div className="mini-card space-y-4 p-8 text-center">
                  <div className="mb-2 inline-flex h-20 w-20 items-center justify-center border border-dg-warning/50 text-dg-warning">
                    <UserSearch className="h-10 w-10" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold uppercase tracking-[0.8px] text-dg-text">Persona No Registrada</h2>
                    <p className="text-dg-text-muted text-sm mt-1">No se encontró coincidencia en la base de datos</p>
                  </div>
                </div>

                <button 
                  onClick={() => navigate("/register/start")}
                  className="mini-btn mini-btn-strong flex w-full items-center justify-center gap-2 py-4 text-sm"
                >
                  <Plus className="h-5 w-5" aria-hidden="true" /> Registrar esta persona
                </button>
              </>
            )}

            <div className="mini-card space-y-6 p-5">
              <div className="flex items-center justify-between">
                <h2 className="mini-h2">Análisis Biométrico 3D</h2>
                <Fingerprint className={`w-6 h-6 ${isFraud ? 'text-dg-error' : isUnknown ? 'text-dg-warning' : 'text-dg-success'}`} />
              </div>

              {metricas && (
                <div className="relative h-64 w-full border border-dg-border p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={[
                      { metric: "Varianza", value: Math.min(((metricas.varianza ?? 0) / 3) * 100, 100) },
                      { metric: "Rango 3D", value: Math.min(((metricas.rango_3d ?? 0) / 10) * 100, 100) },
                      { metric: "Pixeles", value: Math.min(((metricas.pixeles_validos ?? 0)) * 100, 100) },
                      { metric: "Confianza", value: confianzaPct ?? 0 },
                    ]}>
                      <PolarGrid stroke="var(--color-dg-border)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--color-dg-text-muted)', fontSize: 10, fontWeight: 'bold' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--color-dg-card)', border: '1px solid var(--color-dg-border)', borderRadius: 0, fontSize: '12px', letterSpacing: '0.8px' }} />
                      <Radar 
                        name="Huella 3D" 
                        dataKey="value" 
                        stroke={isFraud ? "var(--color-dg-error)" : "var(--color-dg-success)"} 
                        fill={isFraud ? "var(--color-dg-error)" : "var(--color-dg-success)"} 
                        fillOpacity={0.25}
                        isAnimationActive={false}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                  {isFraud && (
                    <div className="absolute left-2 top-2 border border-dg-error/50 bg-dg-bg px-2 py-1 text-2xs font-bold uppercase tracking-[0.8px] text-dg-error">
                      Firma Plana Detectada
                    </div>
                  )}
                  {isAuthorized && (
                    <div className="absolute left-2 top-2 border border-dg-success/50 bg-dg-bg px-2 py-1 text-2xs font-bold uppercase tracking-[0.8px] text-dg-success">
                      Volumen Facial Confirmado
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-6 border-t border-dg-border pt-6 sm:grid-cols-2">
                <MetricItem 
                  label="Confianza Facial" 
                  value={confianzaPct != null ? `${confianzaPct}%` : "N/A"} 
                  progress={confianzaPct ?? 0} 
                  color={isFraud ? "bg-dg-error" : isUnknown ? "bg-dg-warning" : "bg-dg-success"}
                />
                <MetricItem 
                  label="Varianza de Profundidad" 
                  value={metricas?.varianza?.toFixed(1) ?? "—"} 
                  progress={Math.min((metricas?.varianza ?? 0) / 3 * 100, 100)} 
                  color={isFraud ? "bg-dg-error" : "bg-dg-success"}
                />
                <MetricItem 
                  label="Rango 3D" 
                  value={metricas?.rango_3d ? `${metricas.rango_3d.toFixed(1)} cm` : "—"} 
                  progress={Math.min((metricas?.rango_3d ?? 0) / 10 * 100, 100)} 
                  color={isFraud ? "bg-dg-error" : "bg-dg-success"}
                />
                <MetricItem 
                  label="Distancia Física" 
                  value={metricas?.distancia ? `${metricas.distancia.toFixed(0)} cm` : "—"} 
                  progress={Math.min((metricas?.distancia ?? 0) / 150 * 100, 100)} 
                  color="bg-dg-info"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button 
                onClick={descargarInforme}
                disabled={generandoPdf}
                className="mini-btn mini-btn-strong flex w-full items-center justify-center gap-2 py-4 text-sm disabled:opacity-60"
              >
                {generandoPdf ? (
                  "Generando"
                ) : (
                  <>
                    <Download className="w-5 h-5" aria-hidden="true" />
                    Descargar Informe
                  </>
                )}
              </button>

              {errorInforme && (
                <p
                  role="alert"
                  className="border border-dg-warning/50 p-3 text-center text-xs text-dg-warning"
                >
                  {errorInforme}
                </p>
              )}
              <button 
                onClick={() => navigate(-1)}
                className="mini-btn w-full py-4 text-sm"
              >
                Cerrar Detalles
              </button>
            </div>
          </div>
        </div>
      </main>

      <Navigation variante="minimal" />
    </div>
  );
}

function MetricItem({ label, value, progress, color = "bg-dg-info" }: { label: string, value: string, progress: number, color?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">{label}</span>
        <span className={`${color.replace('bg-', 'text-')} tabular text-sm font-bold`}>{value}</span>
      </div>
      {/* Recta y quieta: antes crecia desde cero en cada render. */}
      <div className="h-1 w-full bg-white/5">
        <div className={`${color} h-full`} style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
    </div>
  );
}

// ============================================
// Generación del HTML para el informe PDF
// ============================================

function generarHTMLInforme(evento: Evento, fotoBase64: string): string {
  const isAuthorized = evento.estado === "ACCESO_PERMITIDO";
  const isFraud = evento.estado === "FRAUDE";
  const isUnknown = evento.estado === "DESCONOCIDO";
  const metricas = evento.metricas_json;
  const confianzaPct = evento.confianza != null ? Math.round(evento.confianza * 100) : null;
  const timestamp = new Date(evento.timestamp).toLocaleString("es", {
    dateStyle: "long",
    timeStyle: "medium",
    hour12: true,
  });

  /*
   * Paleta del informe imprimible.
   *
   * Deliberadamente separada de los tokens de la interfaz: el informe se
   * imprime sobre papel blanco y los colores del panel oscuro ahi no valen
   * (ni se leen, ni gastan tinta razonablemente). Lo que se corrige aqui es
   * que estuviera repetida a mano: ${IMPRESION.linea} aparecia diecinueve veces.
   */
  const IMPRESION = {
    texto: "#111827",
    textoSuave: "#6b7280",
    textoTenue: "#9ca3af",
    linea: "${IMPRESION.linea}",
    fondoSuave: "#f9fafb",
    fondoHueco: "#f3f4f6",
    fraude: "#ef4444",
    fraudeFondo: "#fef2f2",
    fraudeBorde: "${IMPRESION.fraudeBorde}",
    fraudeTexto: "#1f2937",
    desconocido: "#eab308",
    desconocidoFondo: "#fefce8",
    desconocidoBorde: "${IMPRESION.desconocidoBorde}",
    desconocidoTexto: "#92400e",
    desconocidoTextoSuave: "#a16207",
    permitido: "#16a34a",
    permitidoFondo: "#f0fdf4",
  } as const;

  const estadoColor = isFraud ? IMPRESION.fraude : isUnknown ? IMPRESION.desconocido : IMPRESION.permitido;
  const estadoLabel = isFraud ? "FRAUDE DETECTADO" : isUnknown ? "PERSONA DESCONOCIDA" : "ACCESO PERMITIDO";
  const estadoBg = isFraud ? IMPRESION.fraudeFondo : isUnknown ? IMPRESION.desconocidoFondo : IMPRESION.permitidoFondo;

  const metricasHTML = `
    <table style="width:100%;border-collapse:collapse;margin-top:8px;">
      <tr>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;color:${IMPRESION.textoSuave};">Confianza</td>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;font-weight:700;text-align:right;">${confianzaPct != null ? confianzaPct + "%" : "N/A"}</td>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;color:${IMPRESION.textoSuave};">Varianza Prof.</td>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;font-weight:700;text-align:right;">${metricas?.varianza?.toFixed(2) ?? "—"}</td>
      </tr>
      <tr>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;color:${IMPRESION.textoSuave};">Rango 3D</td>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;font-weight:700;text-align:right;">${metricas?.rango_3d ? metricas.rango_3d.toFixed(2) + " cm" : "—"}</td>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;color:${IMPRESION.textoSuave};">Distancia</td>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;font-weight:700;text-align:right;">${metricas?.distancia ? metricas.distancia + " cm" : "—"}</td>
      </tr>
    </table>
  `;

  // Solo se incrusta si es realmente un data URI de imagen (lo produce
  // FileReader.readAsDataURL); cualquier otra cosa se descarta.
  const fotoSegura = /^data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+$/i.test(fotoBase64)
    ? fotoBase64
    : "";

  const fotoHTML = fotoSegura
    ? `<img src="${fotoSegura}" alt="Captura del evento" style="width:100%;max-height:200px;object-fit:cover;border-radius:6px;border:1px solid ${IMPRESION.linea};" />`
    : `<div style="width:100%;height:120px;background:${IMPRESION.fondoHueco};border-radius:6px;display:flex;align-items:center;justify-content:center;color:${IMPRESION.textoTenue};font-size:13px;">Sin captura disponible</div>`;

  const usuarioHTML = isAuthorized && evento.nombre
    ? `
      <div style="background:${IMPRESION.fondoSuave};border:1px solid ${IMPRESION.linea};border-radius:8px;padding:12px;margin-top:12px;display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:${estadoColor}18;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;color:${estadoColor};border:2px solid ${estadoColor}44;">
          ${escapeHtml(evento.nombre.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase())}
        </div>
        <div>
          <div style="font-weight:700;font-size:14px;color:${IMPRESION.texto};">${escapeHtml(evento.nombre)}</div>
          <div style="font-size:10px;color:${IMPRESION.textoSuave};font-family:monospace;">ID: ${escapeHtml(evento.usuario_id?.substring(0, 8) ?? "—")}</div>
        </div>
      </div>
    `
    : "";

  const motivoHTML = isFraud
    ? `
      <div style="background:${IMPRESION.fraudeFondo};border:1px solid ${IMPRESION.fraudeBorde};border-radius:8px;padding:12px;margin-top:12px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${IMPRESION.fraude};margin-bottom:6px;">Motivo de Detección</div>
        <div style="font-size:13px;color:${IMPRESION.fraudeTexto};line-height:1.4;">${escapeHtml(evento.motivo ?? "Superficie plana detectada")}</div>
      </div>
    `
    : "";

  const desconocidoHTML = isUnknown
    ? `
      <div style="background:${IMPRESION.desconocidoFondo};border:1px solid ${IMPRESION.desconocidoBorde};border-radius:8px;padding:14px;margin-top:12px;text-align:center;">
        <div style="font-size:15px;font-weight:700;color:${IMPRESION.desconocidoTexto};">Persona No Registrada</div>
        <div style="font-size:12px;color:${IMPRESION.desconocidoTextoSuave};margin-top:2px;">No se encontró coincidencia en la base de datos</div>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Informe DepthGuard — ${escapeHtml(evento.id.substring(0, 8))}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #fff; color: ${IMPRESION.texto}; padding: 0; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      @page { margin: 12mm; size: A4; }
    }
    .container { max-width: 720px; margin: 0 auto; padding: 20px 24px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid ${IMPRESION.texto};padding-bottom:12px;margin-bottom:16px;">
      <div>
        <div style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:${IMPRESION.texto};"> DepthGuard</div>
        <div style="font-size:10px;color:${IMPRESION.textoSuave};margin-top:2px;">Sistema de Control de Acceso Biométrico 3D</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:10px;color:${IMPRESION.textoSuave};">Informe de Evento</div>
        <div style="font-size:10px;font-family:monospace;color:${IMPRESION.textoTenue};">#${escapeHtml(evento.id.substring(0, 8))}</div>
      </div>
    </div>

    <!-- Estado -->
    <div style="background:${estadoBg};border:2px solid ${estadoColor}44;border-radius:8px;padding:10px 16px;display:flex;align-items:center;gap:8px;margin-bottom:14px;">
      <div style="width:8px;height:8px;border-radius:50%;background:${estadoColor};"></div>
      <span style="font-weight:800;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${estadoColor};">${estadoLabel}</span>
    </div>

    <!-- Info general -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <tr>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;color:${IMPRESION.textoSuave};width:30%;">Fecha y Hora</td>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;font-weight:600;">${timestamp}</td>
      </tr>
      <tr>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;color:${IMPRESION.textoSuave};">Cámara</td>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;font-weight:600;">${escapeHtml(evento.camera_id ?? "entrada_principal")} (${escapeHtml(evento.camera_type ?? "3D")})</td>
      </tr>
      <tr>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;color:${IMPRESION.textoSuave};">Verificación</td>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;font-weight:600;">${escapeHtml(evento.verification_level ?? "3D_antispoofing")}</td>
      </tr>
      <tr>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:11px;color:${IMPRESION.textoSuave};">ID Evento</td>
        <td style="padding:6px 10px;border:1px solid ${IMPRESION.linea};font-size:10px;font-family:monospace;">${escapeHtml(evento.id)}</td>
      </tr>
    </table>

    ${usuarioHTML}
    ${motivoHTML}
    ${desconocidoHTML}

    <!-- Captura y Métricas lado a lado -->
    <div style="display:flex;gap:16px;margin-top:14px;">
      <div style="flex:1;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${IMPRESION.textoSuave};margin-bottom:8px;">Captura del Evento</div>
        ${fotoHTML}
      </div>
      <div style="flex:1;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${IMPRESION.textoSuave};margin-bottom:4px;">Análisis Biométrico</div>
        ${metricasHTML}
      </div>
    </div>

    <!-- Footer -->
    <div style="margin-top:20px;padding-top:10px;border-top:1px solid ${IMPRESION.linea};display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:9px;color:${IMPRESION.textoTenue};">
        Generado automáticamente por DepthGuard · ${new Date().toLocaleString("es", { dateStyle: "short", timeStyle: "medium", hour12: true })}
      </div>
      <div style="font-size:9px;color:${IMPRESION.textoTenue};">
        Proyecto de Grado 2026
      </div>
    </div>
  </div>
</body>
</html>`;
}
