import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Video, ExternalLink, Fingerprint, ShieldAlert, UserSearch, Plus, FileText, Download } from "lucide-react";
import { motion } from "motion/react";
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
        <div className="w-8 h-8 border-2 border-dg-info border-t-transparent rounded-full animate-spin" />
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
    <div className="min-h-screen pb-24 lg:pb-0 lg:pl-60 flex flex-col">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} aria-label="Volver a la pantalla anterior" className="active:scale-95 transition-transform">
              <ArrowLeft className="w-6 h-6 text-dg-action-text" aria-hidden="true" />
            </button>
            <h1 className="headline font-bold tracking-tight text-lg text-dg-text">{headerTitle}</h1>
          </div>
        </div>
      </header>

      <main id="contenido" className="px-4 py-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Image and Status */}
          <div className="lg:col-span-7 space-y-6">
            <section className="flex justify-center lg:justify-start">
              {isAuthorized && (
                <div className="px-6 py-3 rounded-full border-2 border-dg-success/30 bg-dg-success/10 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-dg-success" aria-hidden="true" />
                  <span className="headline font-bold text-dg-success text-sm uppercase">ACCESO PERMITIDO</span>
                </div>
              )}
              {isFraud && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-dg-error/30 bg-dg-error/10">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-dg-error opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-dg-error" />
                  </span>
                  <span className="headline font-bold text-xs text-dg-error uppercase">FRAUDE DETECTADO</span>
                </div>
              )}
              {isUnknown && (
                <div className="bg-dg-warning/10 border border-dg-warning/30 px-4 py-2 rounded-full flex items-center gap-3">
                  <div className="relative flex items-center justify-center">
                    <span className="w-2.5 h-2.5 bg-dg-warning rounded-full animate-pulse" />
                  </div>
                  <span className="headline font-bold text-dg-warning text-xs uppercase">PERSONA DESCONOCIDA</span>
                </div>
              )}
            </section>

            <div className={`relative rounded-dg overflow-hidden cyber-card shadow-2xl border border-dg-border ${isUnknown ? 'aspect-video' : 'aspect-[4/3]'}`}>
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
              
              <div className="absolute inset-0 bg-gradient-to-t from-dg-bg via-transparent to-transparent" />
              <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-dg">
                <p className="font-mono tabular text-xs text-white/90">{timestamp}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Details and Actions */}
          <div className="lg:col-span-5 space-y-6">
            {isAuthorized && evento.nombre && (
              <div className="cyber-card p-5 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-dg-input border border-dg-border-hi flex items-center justify-center text-dg-text-secondary headline font-bold text-xl">
                  {evento.nombre.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-grow">
                  <h3 className="text-dg-text headline font-bold text-lg">{evento.nombre}</h3>
                  <p className="text-dg-text-muted text-xs font-mono tabular">ID: #{evento.usuario_id?.substring(0, 8) ?? "—"}</p>
                </div>
                {evento.usuario_id && (
                  <button 
                    onClick={() => navigate(`/profile/${evento.usuario_id}`)}
                    className="text-dg-action-text text-xs font-bold headline flex items-center gap-1 hover:underline transition-colors"
                  >
                    Ver Perfil <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {isFraud && (
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-dg-card p-6 rounded-dg-lg flex items-center gap-5 border border-dg-border">
                  <div className="h-14 w-14 rounded-full bg-dg-error/20 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-8 h-8 text-dg-error" />
                  </div>
                  <div>
                    <h3 className="headline font-bold text-xl text-dg-text">Intento de Suplantación</h3>
                    <p className="text-dg-text-muted text-sm">Ningún usuario identificado</p>
                  </div>
                </div>

                <div className="bg-dg-card p-6 rounded-dg-lg border border-dg-border">
                  <h4 className="headline font-bold text-xs text-dg-error mb-3 uppercase">Motivo de Detección</h4>
                  <p className="text-dg-text text-base leading-relaxed">
                    {evento.motivo ?? "Superficie plana detectada — Varianza de profundidad insuficiente para rostro real"}
                  </p>
                </div>
              </div>
            )}

            {isUnknown && (
              <>
                <div className="bg-dg-card rounded-dg p-8 text-center space-y-4 border border-dg-border">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-dg-warning/10 text-dg-warning mb-2">
                    <UserSearch className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="headline text-2xl font-bold text-dg-text tracking-tight">Persona No Registrada</h2>
                    <p className="text-dg-text-muted text-sm mt-1">No se encontró coincidencia en la base de datos</p>
                  </div>
                </div>

                <button 
                  onClick={() => navigate("/register/start")}
                  className="btn-primary w-full py-4 flex items-center justify-center gap-2"
                >
                  <Plus className="w-6 h-6" /> Registrar esta persona
                </button>
              </>
            )}

            <div className="cyber-card p-5 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="headline font-bold text-dg-text text-base">Análisis Biométrico 3D</h2>
                <Fingerprint className={`w-6 h-6 ${isFraud ? 'text-dg-error' : isUnknown ? 'text-dg-warning' : 'text-dg-success'}`} />
              </div>

              {metricas && (
                <div className="h-64 w-full bg-black/20 rounded-dg p-2 border border-white/5 relative">
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
                      <Tooltip contentStyle={{ backgroundColor: 'var(--color-dg-card)', border: '1px solid var(--color-dg-border)', borderRadius: '10px', fontSize: '12px' }} />
                      <Radar 
                        name="Huella 3D" 
                        dataKey="value" 
                        stroke={isFraud ? "var(--color-dg-error)" : "var(--color-dg-success)"} 
                        fill={isFraud ? "var(--color-dg-error)" : "var(--color-dg-success)"} 
                        fillOpacity={0.4} 
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                  {isFraud && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-dg-error/20 border border-dg-error/30 text-2xs font-bold text-dg-error uppercase rounded-dg-sm backdrop-blur-sm">
                      Firma Plana Detectada
                    </div>
                  )}
                  {isAuthorized && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-dg-success/20 border border-dg-success/30 text-2xs font-bold text-dg-success uppercase rounded-dg-sm backdrop-blur-sm">
                      Volumen Facial Confirmado
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 border-t border-white/5">
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
                  value={metricas?.distancia ? `${metricas.distancia} cm` : "—"} 
                  progress={Math.min((metricas?.distancia ?? 0) / 150 * 100, 100)} 
                  color="bg-dg-info"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button 
                onClick={descargarInforme}
                disabled={generandoPdf}
                className="btn-primary w-full py-4 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {generandoPdf ? (
                  <>
                    <div className="w-5 h-5 border-2 border-dg-bg border-t-transparent rounded-full animate-spin" />
                    Generando...
                  </>
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
                  className="text-xs text-dg-warning bg-dg-warning/5 border border-dg-warning/30 rounded-dg p-3 text-center"
                >
                  {errorInforme}
                </p>
              )}
              <button 
                onClick={() => navigate(-1)}
                className="btn-secondary w-full py-4"
              >
                Cerrar Detalles
              </button>
            </div>
          </div>
        </div>
      </main>

      <Navigation />
    </div>
  );
}

function MetricItem({ label, value, progress, color = "bg-dg-info" }: { label: string, value: string, progress: number, color?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-dg-text-muted text-xs font-semibold">{label}</span>
        <span className={`${color.replace('bg-', 'text-')} font-bold text-sm`}>{value}</span>
      </div>
      <div className="w-full bg-dg-bg rounded-full h-1.5 overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className={`${color} h-full rounded-full`} 
        />
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
