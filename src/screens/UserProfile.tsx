import { Link, useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
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
        <p role="status" className="text-xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Cargando</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dg-bg">
        <p className="text-sm uppercase tracking-[0.8px] text-dg-text-muted">Usuario no encontrado</p>
      </div>
    );
  }

  const initials = user.nombre.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  const alertas = eventos.filter(e => e.estado !== "ACCESO_PERMITIDO").length;

  return (
    <div className="min-h-screen pb-24 lg:pb-0 lg:pt-16 flex flex-col bg-dg-bg">
      <header className="sticky top-0 lg:top-16 z-40 w-full border-b border-dg-border bg-dg-bg">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} aria-label="Volver a la pantalla anterior" className="text-dg-action-text hover:text-dg-text">
              <ArrowLeft className="h-6 w-6" aria-hidden="true" />
            </button>
            <h1 className="text-xl font-bold uppercase tracking-[0.8px] text-dg-text">Perfil de Usuario</h1>
          </div>
        </div>
      </header>

      <main id="contenido" className="px-6 py-6 max-w-7xl mx-auto pb-32 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Profile Info & Actions */}
          <div className="lg:col-span-4 space-y-6">
            <section className="card flex flex-col items-center space-y-4 py-8 text-center">
              <div className="relative">
                <div className="flex h-24 w-24 items-center justify-center border border-dg-border">
                  <span className="text-3xl font-bold text-dg-text-secondary">{initials}</span>
                </div>
                {/* Punto cuadrado y quieto. El estado va escrito en la ficha
                    de informacion, asi que aqui el color solo lo repite. */}
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center bg-dg-bg">
                  <div
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 ${user.activo ? 'bg-dg-success' : 'bg-dg-text-muted'}`}
                  />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-dg-text">{user.nombre}</h2>
            </section>

            <div className="grid grid-cols-2 gap-4">
              <div className="card p-5">
                <p className="text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Accesos Totales</p>
                <p className="tabular mt-2 text-3xl font-bold text-dg-text">{accesos}</p>
              </div>
              <div className="card p-5">
                <p className="text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">Alertas Generadas</p>
                <p className="tabular mt-2 text-3xl font-bold text-dg-text">{alertas}</p>
              </div>
            </div>

            <div className="space-y-3 pt-4 lg:pt-0">
              <button 
                onClick={() => navigate(`/users/edit/${user.id}`)}
                className="btn w-full py-4 text-sm"
              >
                Editar Usuario
              </button>
              <button 
                onClick={() => navigate(`/users/delete/${user.id}`)}
                className="w-full border border-dg-error/50 py-4 text-sm font-bold uppercase tracking-[0.8px] text-dg-error hover:bg-dg-error hover:text-dg-bg"
              >
                Eliminar Usuario
              </button>
            </div>
          </div>

          {/* Right Column: Details & Captures */}
          <div className="lg:col-span-8 space-y-6">
            <div className="card space-y-4 p-6">
              <h3 className="panel-title mb-4">Información</h3>
              <div className="space-y-4">
                <InfoRow label="ID" value={`#${user.id.substring(0, 8)}`} mono />
                <InfoRow label="Fecha de Registro" value={new Date(user.fecha_registro).toLocaleDateString("es")} />
                <InfoRow label="Ángulos capturados" value={`${user.num_angulos} de 5`} />
                <InfoRow label="Estado" value={user.activo ? "Activo" : "Inactivo"} />
                <InfoRow label="Notas" value={user.notas || "Sin notas"} />
              </div>
            </div>

            {eventos.length > 0 && (
              <div className="card p-6">
                <h3 className="panel-title mb-4">Últimas Capturas</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {eventos.filter(e => e.foto_url).map((evento) => (
                    <Link
                      key={evento.id}
                      to={`/event/${evento.id}`}
                      className="group relative block aspect-square overflow-hidden border border-dg-border bg-dg-canvas"
                    >
                      <img 
                        className="h-full w-full object-cover grayscale opacity-80 group-hover:opacity-100 group-hover:grayscale-0" 
                        src={evento.foto_url!} 
                        alt={`Captura del ${new Date(evento.timestamp).toLocaleString("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
                      />
                      <div className="absolute bottom-0 right-0 bg-dg-bg/80 px-1 font-mono text-2xs text-dg-text">
                        {new Date(evento.timestamp).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit", hour12: true })}
                      </div>
                    </Link>
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
      <span className="text-sm text-dg-text-muted">{label}</span>
      <span className={`text-sm text-dg-text ${mono ? 'font-mono tabular border border-dg-border px-2 py-1' : ''}`}>{value}</span>
    </div>
  );
}
