import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Video, ExternalLink, Fingerprint, ShieldAlert, UserSearch, Plus, FileText, Download } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";
import { getEventoPorId, type Evento } from "../lib/supabase";

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);
  const [generandoPdf, setGenerandoPdf] = useState(false);

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
        <div className="w-8 h-8 border-2 border-dg-accent border-t-transparent rounded-full animate-spin" />
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
  const timestamp = new Date(evento.timestamp).toLocaleString("es", { dateStyle: "short", timeStyle: "medium" });

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
        alert("Permite las ventanas emergentes para descargar el informe.");
        return;
      }

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
    <div className="min-h-screen pb-24 flex flex-col">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="active:scale-95 transition-transform">
              <ArrowLeft className="w-6 h-6 text-dg-accent" />
            </button>
            <h1 className="font-headline font-bold tracking-tight text-lg text-white">{headerTitle}</h1>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Image and Status */}
          <div className="lg:col-span-7 space-y-6">
            <section className="flex justify-center lg:justify-start">
              {isAuthorized && (
                <div className="px-6 py-3 rounded-full border-2 border-dg-accent/30 bg-dg-accent/10 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-dg-accent animate-pulse" />
                  <span className="font-headline font-bold text-dg-accent tracking-widest text-sm uppercase">ACCESO PERMITIDO</span>
                </div>
              )}
              {isFraud && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-dg-error/30 bg-dg-error/10">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-dg-error opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-dg-error" />
                  </span>
                  <span className="font-headline font-bold text-xs tracking-widest text-dg-error uppercase">FRAUDE DETECTADO</span>
                </div>
              )}
              {isUnknown && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 px-4 py-2 rounded-full flex items-center gap-3">
                  <div className="relative flex items-center justify-center">
                    <span className="w-2.5 h-2.5 bg-yellow-500 rounded-full animate-pulse" />
                  </div>
                  <span className="font-headline font-bold text-yellow-500 text-xs tracking-widest uppercase">PERSONA DESCONOCIDA</span>
                </div>
              )}
            </section>

            <div className={`relative rounded-xl overflow-hidden cyber-card shadow-2xl border border-dg-border ${isUnknown ? 'aspect-video' : 'aspect-[4/3]'}`}>
              {isFraud && <div className="absolute inset-0 bg-dg-error/20 mix-blend-overlay z-10 pointer-events-none" />}
              {evento.foto_url ? (
                <img 
                  className={`w-full h-full object-cover opacity-80 ${!isAuthorized ? 'grayscale' : ''}`} 
                  src={evento.foto_url} 
                  alt="Captura"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-dg-bg text-dg-text-muted">
                  <Video className="w-16 h-16 opacity-20" />
                </div>
              )}
              
              <div className="absolute inset-0 bg-gradient-to-t from-dg-bg via-transparent to-transparent" />
              <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg">
                <p className="font-mono text-xs text-white/90 tracking-tighter">{timestamp}</p>
              </div>
            </div>
          </div>

          {/* Right Column: Details and Actions */}
          <div className="lg:col-span-5 space-y-6">
            {isAuthorized && evento.nombre && (
              <div className="cyber-card p-5 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-dg-accent/20 border-2 border-dg-accent flex items-center justify-center text-dg-accent font-headline font-bold text-xl">
                  {evento.nombre.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-grow">
                  <h3 className="text-white font-headline font-bold text-lg">{evento.nombre}</h3>
                  <p className="text-dg-text-muted text-xs font-mono">ID: #{evento.usuario_id?.substring(0, 8) ?? "—"}</p>
                </div>
                {evento.usuario_id && (
                  <button 
                    onClick={() => navigate(`/profile/${evento.usuario_id}`)}
                    className="text-dg-accent text-xs font-bold font-headline flex items-center gap-1 hover:opacity-70 transition-all"
                  >
                    Ver Perfil <ExternalLink className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {isFraud && (
              <div className="grid grid-cols-1 gap-4">
                <div className="bg-dg-card p-6 rounded-2xl flex items-center gap-5 border border-dg-border">
                  <div className="h-14 w-14 rounded-full bg-dg-error/20 flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-8 h-8 text-dg-error" />
                  </div>
                  <div>
                    <h3 className="font-headline font-bold text-xl text-white">Intento de Suplantación</h3>
                    <p className="text-dg-text-muted text-sm">Ningún usuario identificado</p>
                  </div>
                </div>

                <div className="bg-dg-card p-6 rounded-2xl border border-dg-border">
                  <h4 className="font-headline font-bold text-xs tracking-widest text-dg-error mb-3 uppercase">Motivo de Detección</h4>
                  <p className="text-white text-base leading-relaxed">
                    {evento.motivo ?? "Superficie plana detectada — Varianza de profundidad insuficiente para rostro real"}
                  </p>
                </div>
              </div>
            )}

            {isUnknown && (
              <>
                <div className="bg-dg-card rounded-xl p-8 text-center space-y-4 border border-dg-border">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500/10 text-yellow-500 mb-2">
                    <UserSearch className="w-10 h-10" />
                  </div>
                  <div>
                    <h2 className="font-headline text-2xl font-bold text-white tracking-tight">Persona No Registrada</h2>
                    <p className="text-dg-text-muted text-sm mt-1">No se encontró coincidencia en la base de datos</p>
                  </div>
                </div>

                <button 
                  onClick={() => navigate("/register/start")}
                  className="btn-primary w-full py-4 font-headline font-black uppercase tracking-tighter text-lg flex items-center justify-center gap-2"
                >
                  <Plus className="w-6 h-6" /> Registrar esta persona
                </button>
              </>
            )}

            <div className="cyber-card p-5 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-headline font-bold text-white text-base">Análisis Biométrico</h2>
                <Fingerprint className={`w-6 h-6 ${isFraud ? 'text-dg-error' : isUnknown ? 'text-yellow-500' : 'text-dg-accent'}`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <MetricItem 
                  label="Confianza" 
                  value={confianzaPct != null ? `${confianzaPct}%` : "N/A"} 
                  progress={confianzaPct ?? 0} 
                  color={isFraud ? "bg-dg-error" : isUnknown ? "bg-yellow-500" : "bg-dg-accent"}
                />
                <MetricItem 
                  label="Varianza de Profundidad" 
                  value={metricas?.varianza?.toFixed(1) ?? "—"} 
                  progress={Math.min((metricas?.varianza ?? 0) / 3 * 100, 100)} 
                  color={isFraud ? "bg-dg-error" : "bg-dg-accent"}
                />
                <MetricItem 
                  label="Rango 3D" 
                  value={metricas?.rango_3d ? `${metricas.rango_3d.toFixed(1)} cm` : "—"} 
                  progress={Math.min((metricas?.rango_3d ?? 0) / 10 * 100, 100)} 
                  color={isFraud ? "bg-dg-error" : "bg-dg-accent"}
                />
                <MetricItem 
                  label="Distancia" 
                  value={metricas?.distancia ? `${metricas.distancia} cm` : "—"} 
                  progress={Math.min((metricas?.distancia ?? 0) / 150 * 100, 100)} 
                  color="bg-blue-400"
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
                    <Download className="w-5 h-5" />
                    Descargar Informe
                  </>
                )}
              </button>
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

function MetricItem({ label, value, progress, color = "bg-dg-accent" }: { label: string, value: string, progress: number, color?: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-dg-text-muted text-xs uppercase tracking-widest font-semibold">{label}</span>
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
  });

  const estadoColor = isFraud ? "#ef4444" : isUnknown ? "#eab308" : "#a3ff00";
  const estadoLabel = isFraud ? "FRAUDE DETECTADO" : isUnknown ? "PERSONA DESCONOCIDA" : "ACCESO PERMITIDO";
  const estadoBg = isFraud ? "#fef2f2" : isUnknown ? "#fefce8" : "#f0fdf4";

  const metricasHTML = `
    <table style="width:100%;border-collapse:collapse;margin-top:12px;">
      <tr>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Confianza</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:700;text-align:right;">${confianzaPct != null ? confianzaPct + "%" : "N/A"}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Varianza de Profundidad</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:700;text-align:right;">${metricas?.varianza?.toFixed(2) ?? "—"}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Rango 3D</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:700;text-align:right;">${metricas?.rango_3d ? metricas.rango_3d.toFixed(2) + " cm" : "—"}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">Distancia</td>
        <td style="padding:10px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:700;text-align:right;">${metricas?.distancia ? metricas.distancia + " cm" : "—"}</td>
      </tr>
    </table>
  `;

  const fotoHTML = fotoBase64
    ? `<img src="${fotoBase64}" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb;" />`
    : `<div style="width:100%;height:200px;background:#f3f4f6;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:14px;">Sin captura disponible</div>`;

  const usuarioHTML = isAuthorized && evento.nombre
    ? `
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-top:16px;display:flex;align-items:center;gap:16px;">
        <div style="width:48px;height:48px;border-radius:50%;background:${estadoColor}22;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:18px;color:${estadoColor};border:2px solid ${estadoColor}44;">
          ${evento.nombre.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase()}
        </div>
        <div>
          <div style="font-weight:700;font-size:16px;color:#111827;">${evento.nombre}</div>
          <div style="font-size:11px;color:#6b7280;font-family:monospace;">ID: ${evento.usuario_id?.substring(0, 8) ?? "—"}</div>
        </div>
      </div>
    `
    : "";

  const motivoHTML = isFraud
    ? `
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:16px;margin-top:16px;">
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#ef4444;margin-bottom:8px;">Motivo de Detección</div>
        <div style="font-size:14px;color:#1f2937;line-height:1.5;">${evento.motivo ?? "Superficie plana detectada"}</div>
      </div>
    `
    : "";

  const desconocidoHTML = isUnknown
    ? `
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:20px;margin-top:16px;text-align:center;">
        <div style="font-size:18px;font-weight:700;color:#92400e;">Persona No Registrada</div>
        <div style="font-size:13px;color:#a16207;margin-top:4px;">No se encontró coincidencia en la base de datos</div>
      </div>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Informe DepthGuard — ${evento.id.substring(0, 8)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #fff; color: #111827; padding: 0; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      @page { margin: 15mm; size: A4; }
    }
    .container { max-width: 720px; margin: 0 auto; padding: 32px 24px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #111827;padding-bottom:16px;margin-bottom:24px;">
      <div>
        <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#111827;">🛡️ DepthGuard</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px;">Sistema de Control de Acceso Biométrico 3D</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:11px;color:#6b7280;">Informe de Evento</div>
        <div style="font-size:11px;font-family:monospace;color:#9ca3af;">#${evento.id.substring(0, 8)}</div>
      </div>
    </div>

    <!-- Estado -->
    <div style="background:${estadoBg};border:2px solid ${estadoColor}44;border-radius:10px;padding:14px 20px;display:flex;align-items:center;gap:10px;margin-bottom:20px;">
      <div style="width:10px;height:10px;border-radius:50%;background:${estadoColor};"></div>
      <span style="font-weight:800;font-size:14px;letter-spacing:1px;text-transform:uppercase;color:${estadoColor};">${estadoLabel}</span>
    </div>

    <!-- Info general -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;width:40%;">Fecha y Hora</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:600;">${timestamp}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;">Cámara</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:600;">${evento.camera_id ?? "entrada_principal"} (${evento.camera_type ?? "3D"})</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;">Nivel de Verificación</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;font-weight:600;">${evento.verification_level ?? "3D_antispoofing"}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:12px;color:#6b7280;">ID del Evento</td>
        <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:12px;font-family:monospace;">${evento.id}</td>
      </tr>
    </table>

    ${usuarioHTML}
    ${motivoHTML}
    ${desconocidoHTML}

    <!-- Captura -->
    <div style="margin-top:24px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:10px;">Captura del Evento</div>
      ${fotoHTML}
    </div>

    <!-- Métricas -->
    <div style="margin-top:24px;">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:4px;">Análisis Biométrico</div>
      ${metricasHTML}
    </div>

    <!-- Footer -->
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:10px;color:#9ca3af;">
        Generado automáticamente por DepthGuard · ${new Date().toLocaleString("es")}
      </div>
      <div style="font-size:10px;color:#9ca3af;">
        Proyecto de Grado 2026
      </div>
    </div>
  </div>
</body>
</html>`;
}
