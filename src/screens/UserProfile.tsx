import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import Navigation from "../components/Navigation";
import { getUsuarioPorId, contarAccesosUsuario, getEventosUsuario, type Usuario, type Evento } from "../lib/supabase";

export default function UserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<Usuario | null>(null);
  const [accesos, setAccesos] = useState(0);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      if (!id) return;
      try {
        const usuario = await getUsuarioPorId(id);
        setUser(usuario);

        const [totalAccesos, ultimosEventos] = await Promise.all([
          contarAccesosUsuario(usuario.nombre),
          getEventosUsuario(usuario.nombre, 3),
        ]);
        setAccesos(totalAccesos);
        setEventos(ultimosEventos);
      } catch (err) {
        console.error("Error cargando perfil:", err);
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dg-bg">
        <p className="text-dg-text-muted">Usuario no encontrado</p>
      </div>
    );
  }

  const initials = user.nombre.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  const alertas = eventos.filter(e => e.estado !== "ACCESO_PERMITIDO").length;

  return (
    <div className="min-h-screen pb-24 flex flex-col bg-dg-bg">
      <header className="fixed top-0 w-full z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="active:scale-95 transition-transform">
              <ArrowLeft className="w-6 h-6 text-dg-accent" />
            </button>
            <h1 className="font-headline font-bold text-xl tracking-wider text-white">Perfil de Usuario</h1>
          </div>
        </div>
      </header>

      <main className="pt-24 px-6 max-w-7xl mx-auto pb-32 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Profile Info & Actions */}
          <div className="lg:col-span-4 space-y-6">
            <section className="flex flex-col items-center text-center space-y-4 py-8 bg-dg-card rounded-xl border border-dg-border">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-dg-accent flex items-center justify-center shadow-[0_0_20px_rgba(163,255,0,0.3)]">
                  <span className="font-headline font-black text-3xl text-dg-bg">{initials}</span>
                </div>
                <div className="absolute bottom-0 right-0 w-6 h-6 bg-dg-bg rounded-full flex items-center justify-center border-2 border-dg-bg">
                  <div className={`w-3 h-3 rounded-full ${user.activo ? 'bg-dg-success animate-pulse' : 'bg-dg-text-muted'}`} />
                </div>
              </div>
              <div>
                <h2 className="font-headline font-bold text-2xl text-white">{user.nombre}</h2>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-dg-card p-5 rounded-xl border-l-2 border-dg-accent border-y border-r border-dg-border">
                <p className="text-dg-text-muted text-[10px] font-bold uppercase tracking-widest">Accesos Totales</p>
                <p className="font-headline font-black text-4xl text-dg-accent mt-1">{accesos}</p>
              </div>
              <div className="bg-dg-card p-5 rounded-xl border-l-2 border-dg-text-muted border-y border-r border-dg-border">
                <p className="text-dg-text-muted text-[10px] font-bold uppercase tracking-widest">Alertas Generadas</p>
                <p className="font-headline font-black text-4xl text-white mt-1">{alertas}</p>
              </div>
            </div>

            <div className="space-y-3 pt-4 lg:pt-0">
              <button 
                onClick={() => navigate(`/users/edit/${user.id}`)}
                className="w-full py-4 rounded-xl border border-dg-accent text-dg-accent font-headline font-bold uppercase tracking-widest text-sm bg-dg-accent/5 hover:bg-dg-accent/10 transition-all active:scale-95"
              >
                Editar Usuario
              </button>
              <button 
                onClick={() => navigate(`/users/delete/${user.id}`)}
                className="w-full py-4 rounded-xl border border-dg-error/40 text-dg-error font-headline font-bold uppercase tracking-widest text-sm hover:bg-dg-error/10 transition-all active:scale-95"
              >
                Eliminar Usuario
              </button>
            </div>
          </div>

          {/* Right Column: Details & Captures */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-dg-card p-6 rounded-xl space-y-4 border border-dg-border">
              <h3 className="font-headline font-bold text-sm text-dg-text-muted uppercase tracking-widest mb-4">Información</h3>
              <div className="space-y-4">
                <InfoRow label="ID" value={`#${user.id.substring(0, 8)}`} mono />
                <InfoRow label="Fecha de Registro" value={new Date(user.fecha_registro).toLocaleDateString("es")} />
                <InfoRow label="Ángulos capturados" value={`${user.num_angulos} de 5`} />
                <InfoRow label="Estado" value={user.activo ? "Activo" : "Inactivo"} />
                <InfoRow label="Notas" value={user.notas || "Sin notas"} />
              </div>
            </div>

            {eventos.length > 0 && (
              <div className="bg-dg-card p-6 rounded-xl border border-dg-border">
                <h3 className="font-headline font-bold text-sm text-dg-text-muted uppercase tracking-widest mb-4">Últimas Capturas</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {eventos.filter(e => e.foto_url).map((evento) => (
                    <div key={evento.id} className="aspect-square bg-dg-bg rounded-lg overflow-hidden border border-dg-border relative group cursor-pointer" onClick={() => navigate(`/event/${evento.id}`)}>
                      <img 
                        className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300" 
                        src={evento.foto_url!} 
                        alt="Capture"
                      />
                      <div className="absolute bottom-1 right-1 bg-dg-bg/80 text-[8px] px-1 rounded font-mono text-white">
                        {new Date(evento.timestamp).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Navigation />
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string, value: string, mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-dg-text-muted text-sm font-medium">{label}</span>
      <span className={`text-white text-sm ${mono ? 'font-mono bg-dg-bg px-2 py-1 rounded' : ''}`}>{value}</span>
    </div>
  );
}
