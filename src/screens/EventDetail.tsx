import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Video, ExternalLink, Fingerprint, ShieldAlert, UserSearch, Plus, FileText } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";

export default function EventDetail() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();

  const isAuthorized = type === "authorized";
  const isFraud = type === "fraud";
  const isUnknown = type === "unknown";

  const headerTitle = isFraud ? "Detalle de Fraude" : "Detalle del Evento";

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
              <img 
                className={`w-full h-full object-cover opacity-80 ${!isAuthorized ? 'grayscale' : ''}`} 
                src={`https://picsum.photos/seed/${isFraud ? 'fraud' : isUnknown ? 'unknown' : 'face'}-scan/800/600`} 
                alt="Scan"
                referrerPolicy="no-referrer"
              />
              
              {isAuthorized && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-dg-bg via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                    <div className="flex items-center gap-2 text-dg-accent">
                      <Video className="w-4 h-4 fill-dg-accent" />
                      <span className="text-xs font-bold font-headline uppercase tracking-tighter">Cámara</span>
                    </div>
                    <div className="text-right">
                      <p className="text-dg-text-muted text-[10px] uppercase font-bold tracking-widest">Timestamp</p>
                      <p className="text-white text-xs font-mono">2026-10-27 14:32:05</p>
                    </div>
                  </div>
                </>
              )}

              {isFraud && (
                <div className="absolute bottom-4 left-4 z-20">
                  <div className="bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg">
                    <p className="font-mono text-xs text-white/90 tracking-tighter">2026-04-11 14:35:12</p>
                  </div>
                </div>
              )}

              {isUnknown && (
                <>
                  <div className="absolute bottom-4 right-4 bg-dg-bg/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-dg-border">
                    <code className="text-[10px] text-dg-text-muted font-mono">2026-10-27 14:32:05</code>
                  </div>
                  <div className="absolute top-4 left-4">
                    <div className="w-12 h-12 border-t-2 border-l-2 border-yellow-500/40 rounded-tl-lg" />
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <div className="w-12 h-12 border-b-2 border-l-2 border-yellow-500/40 rounded-bl-lg" />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Details and Actions */}
          <div className="lg:col-span-5 space-y-6">
            {isAuthorized && (
              <div className="cyber-card p-5 flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-dg-accent/20 border-2 border-dg-accent flex items-center justify-center text-dg-accent font-headline font-bold text-xl">
                  JP
                </div>
                <div className="flex-grow">
                  <h3 className="text-white font-headline font-bold text-lg">Juan Pérez</h3>
                  <p className="text-dg-text-muted text-xs font-mono">ID: #1</p>
                </div>
                <button 
                  onClick={() => navigate("/profile/juan")}
                  className="text-dg-accent text-xs font-bold font-headline flex items-center gap-1 hover:opacity-70 transition-all"
                >
                  Ver Perfil <ExternalLink className="w-4 h-4" />
                </button>
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

                <div className="bg-dg-card p-6 rounded-2xl border-l-4 border-dg-error border-y border-r border-dg-border">
                  <h4 className="font-headline font-bold text-xs tracking-widest text-dg-error mb-3 uppercase">Motivo de Detección</h4>
                  <p className="text-white text-base leading-relaxed">
                    Superficie plana detectada — Varianza de profundidad insuficiente para rostro real
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
                {isAuthorized && (
                  <>
                    <MetricItem label="Confianza" value="94%" progress={94} />
                    <MetricItem label="Varianza de Profundidad" value="1.2" progress={40} />
                    <MetricItem label="Rango 3D" value="6.5cm" progress={65} />
                    <MetricItem label="Distancia" value="45cm" progress={45} color="bg-blue-400" />
                  </>
                )}
                {isFraud && (
                  <>
                    <MetricItem label="Confianza" value="N/A" progress={0} color="bg-dg-error" />
                    <MetricItem label="Varianza de Profundidad" value="0.3" progress={15} color="bg-dg-error" />
                    <MetricItem label="Rango 3D" value="0.8 cm" progress={10} color="bg-dg-error" />
                    <MetricItem label="Distancia" value="70 cm" progress={60} color="bg-blue-400" />
                  </>
                )}
                {isUnknown && (
                  <>
                    <MetricItem label="Confianza" value="0% / Sin match" progress={0} color="bg-yellow-500" />
                    <MetricItem label="Varianza de Profundidad" value="1.8" progress={75} color="bg-dg-success" />
                    <MetricItem label="Rango 3D" value="5.2 cm" progress={85} color="bg-dg-success" />
                    <MetricItem label="Distancia" value="55 cm" progress={50} color="bg-blue-400" />
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button className="btn-primary w-full py-4 flex items-center justify-center gap-2">
                <FileText className="w-5 h-5" /> Descargar Informe
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
