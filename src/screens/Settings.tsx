import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Volume2, VolumeX, Server, Video, Bell, Database, LogOut, UserPlus, Trash2, Mail, CheckCircle, XCircle, Users, BellRing, BellOff } from "lucide-react";
import Navigation from "../components/Navigation";
import { getEstadoSistema, isEdgeOnline, isCamaraActiva, logoutAdmin, listarAdmins, invitarAdmin, eliminarAdmin, establecerPropietario, type EstadoSistema, type AdminUser, getEmailNotificationPreference, toggleEmailNotifications } from "../lib/supabase";
import { subscribeToPush, unsubscribeFromPush, getPushStatus, isSubscribed, type PushStatus } from "../lib/pushNotifications";
import { sonidoActivado, activarSonido, sonarAlerta } from "../lib/alertaSonora";

export default function Settings() {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<EstadoSistema | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado de administradores
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [callerId, setCallerId] = useState("");
  const [callerRole, setCallerRole] = useState("");
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [adminsError, setAdminsError] = useState<string | null>(null);
  const [settingOwner, setSettingOwner] = useState(false);

  // Estado del formulario de invitación
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Estado de eliminación
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Estado de notificaciones push
  const [pushStatus, setPushStatus] = useState<PushStatus>("default");
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushChecking, setPushChecking] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [sonido, setSonido] = useState(sonidoActivado);

  // Estado de notificaciones email
  const [emailSubscribed, setEmailSubscribed] = useState(true);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailChecking, setEmailChecking] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const data = await getEstadoSistema();
        setEstado(data);
      } catch (err) {
        console.error("Error cargando estado:", err);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  // Cargar estado de push al montar
  useEffect(() => {
    async function checkPush() {
      setPushChecking(true);
      const status = getPushStatus();
      setPushStatus(status);
      if (status === "granted") {
        const subscribed = await isSubscribed();
        setPushSubscribed(subscribed);
      }
      setPushChecking(false);
    }
    async function checkEmail() {
      setEmailChecking(true);
      const active = await getEmailNotificationPreference();
      setEmailSubscribed(active);
      setEmailChecking(false);
    }
    checkPush();
    checkEmail();
  }, []);

  // Cargar lista de administradores
  useEffect(() => {
    cargarAdmins();
  }, []);

  async function cargarAdmins() {
    setAdminsLoading(true);
    setAdminsError(null);
    try {
      const data = await listarAdmins();
      setAdmins(data.admins);
      setCallerId(data.callerId);
      setCallerRole(data.callerRole);
    } catch (err) {
      setAdminsError((err as Error).message);
    } finally {
      setAdminsLoading(false);
    }
  }

  const handleLogout = async () => {
    await logoutAdmin();
    navigate("/");
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviteLoading(true);
    setInviteResult(null);

    const result = await invitarAdmin(inviteEmail.trim());

    if (result.success) {
      setInviteResult({ type: "success", message: `Invitación enviada a ${inviteEmail}` });
      setInviteEmail("");
      setShowInviteForm(false);
      // Recargar lista
      cargarAdmins();
    } else {
      setInviteResult({ type: "error", message: result.error ?? "Error enviando invitación" });
    }

    setInviteLoading(false);

    // Limpiar mensaje después de 5s
    setTimeout(() => setInviteResult(null), 5000);
  };

  const handleDelete = async (userId: string) => {
    setDeletingId(userId);
    const result = await eliminarAdmin(userId);

    if (result.success) {
      setAdmins((prev) => prev.filter((a) => a.id !== userId));
      setInviteResult({ type: "success", message: "Administrador eliminado" });
    } else {
      setInviteResult({ type: "error", message: result.error ?? "Error eliminando administrador" });
    }

    setDeletingId(null);
    setConfirmDeleteId(null);

    setTimeout(() => setInviteResult(null), 5000);
  };

  // Verificar si el nodo edge está online basado en heartbeat
  const servidorConectado = isEdgeOnline(estado?.ultimo_heartbeat ?? null);

  // Manejar toggle de notificaciones push
  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      if (pushSubscribed) {
        await unsubscribeFromPush();
        setPushSubscribed(false);
        setInviteResult({ type: "success", message: "Notificaciones push desactivadas" });
      } else {
        const token = await subscribeToPush();
        if (token) {
          setPushSubscribed(true);
          setPushStatus("granted");
          setInviteResult({ type: "success", message: "Notificaciones push activadas" });
        } else {
          const newStatus = getPushStatus();
          setPushStatus(newStatus);
          if (newStatus === "denied") {
            setInviteResult({ type: "error", message: "Permiso de notificaciones bloqueado. Desbloquéalo desde la configuración del navegador." });
          } else {
            setInviteResult({ type: "error", message: "No se pudo activar las notificaciones push." });
          }
        }
      }
    } catch (err) {
      setInviteResult({ type: "error", message: "Error al cambiar notificaciones push." });
    } finally {
      setPushLoading(false);
      setTimeout(() => setInviteResult(null), 5000);
    }
  };

  // Manejar toggle de notificaciones email
  const handleEmailToggle = async () => {
    setEmailLoading(true);
    try {
      const newState = !emailSubscribed;
      const result = await toggleEmailNotifications(newState);
      if (result.success) {
        setEmailSubscribed(newState);
        setInviteResult({ type: "success", message: `Notificaciones de email ${newState ? "activadas" : "desactivadas"}` });
      } else {
        setInviteResult({ type: "error", message: result.error ?? "Error al cambiar notificaciones de email." });
      }
    } catch (err) {
      setInviteResult({ type: "error", message: "Error al cambiar notificaciones de email." });
    } finally {
      setEmailLoading(false);
      setTimeout(() => setInviteResult(null), 5000);
    }
  };

  function formatAdminDate(fecha: string | null) {
    if (!fecha) return "Nunca";
    return new Date(fecha).toLocaleDateString("es", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  }

  return (
    <div className="mini min-h-screen pb-24 lg:pb-0 lg:pt-16 flex flex-col bg-dg-bg">
      {/* Sin cabecera de titulo: la barra de navegacion ya dice donde
          estas. El <h1> se conserva para lectores de pantalla, que si
          necesitan oir el nombre de la pagina al entrar. */}
      <h1 className="sr-only">Ajustes</h1>

      <main id="contenido" className="flex-1 px-4 py-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Mensaje de resultado global */}
        {inviteResult && (
          <div
            role="status"
            className={`flex items-center gap-3 border p-4 ${
              inviteResult.type === "success"
                ? "border-dg-success/50 text-dg-success"
                : "border-dg-error/50 text-dg-error"
            }`}
          >
            {inviteResult.type === "success" ? (
              <CheckCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span className="text-sm font-medium">{inviteResult.message}</span>
          </div>
        )}

        {loading ? (
          <p
            role="status"
            className="py-20 text-center text-xs font-bold uppercase tracking-[0.8px] text-dg-text-muted"
          >
            Cargando
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <section className="mini-card space-y-4 p-5">
                <h2 className="mini-h2">Estado del Sistema</h2>
                <div className="space-y-4">
                  <StatusRow label="Nodo Edge" icon={Server} connected={servidorConectado} />
                  {(() => {
                    const cam = (estado?.camaras ?? [])[0];
                    if (!cam) return null;
                    return (
                      <div>
                        <StatusRow 
                          label={`Cámara (${cam.camera_type})`}
                          icon={Video}
                          connected={isCamaraActiva(cam, estado?.ultimo_heartbeat ?? null)}
                        />
                      </div>
                    );
                  })()}
                  <StatusRow label="Push" icon={Bell} connected={pushSubscribed} />
                  <StatusRow label="Base de Datos" icon={Database} connected={true} />
                </div>
              </section>

              <section className="mini-card space-y-5 p-5">
                <h2 className="mini-h2">Notificaciones</h2>
                <div className="space-y-6">
                  {/* Push Notifications Toggle */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {pushSubscribed ? (
                          <BellRing className="w-5 h-5 text-dg-text-secondary" aria-hidden="true" />
                        ) : (
                          <BellOff className="w-5 h-5 text-dg-text-muted" />
                        )}
                        <div>
                          <span className="text-sm font-medium">Notificaciones Push</span>
                          <p className="text-2xs text-dg-text-muted mt-0.5">
                            Alertas instantáneas de fraude y accesos desconocidos
                          </p>
                        </div>
                      </div>
                      {pushChecking ? (
                        <span className="flex h-6 w-11 items-center justify-center border border-dg-border text-2xs font-bold text-dg-text-muted">
                          ···
                        </span>
                      ) : pushStatus === "unsupported" ? (
                        <span className="border border-dg-border px-2 py-1 text-2xs uppercase tracking-[0.8px] text-dg-text-muted">No soportado</span>
                      ) : (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={pushSubscribed}
                          aria-label="Notificaciones push en este dispositivo"
                          disabled={pushLoading}
                          onClick={handlePushToggle}
                          className={`flex h-6 w-11 items-center border px-0.5 ${
                            pushLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                          } ${pushSubscribed ? 'border-dg-success bg-dg-success' : 'border-dg-border'}`}
                        >
                          <span
                            aria-hidden="true"
                            className={`h-5 w-5 ${pushSubscribed ? 'translate-x-[18px] bg-dg-bg' : 'bg-dg-text-muted'}`}
                          />
                        </button>
                      )}
                    </div>
                    {pushStatus === "denied" && (
                      <p className="border border-dg-error/50 px-3 py-2 text-2xs text-dg-error">
                         Notificaciones bloqueadas por el navegador. Ve a la configuración del sitio para desbloquearlas.
                      </p>
                    )}
                  </div>

                  {/* Email Backup Indicator */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <Mail className="w-5 h-5 text-dg-text-muted" />
                      <div>
                        <span className="text-sm font-medium">Email de respaldo</span>
                        <p className="text-2xs text-dg-text-muted mt-0.5">
                          Se envía email automáticamente ante eventos de seguridad
                        </p>
                      </div>
                    </div>
                    {emailChecking ? (
                      <span className="flex h-6 w-11 items-center justify-center border border-dg-border text-2xs font-bold text-dg-text-muted">
                        ···
                      </span>
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={emailSubscribed}
                        aria-label="Email de respaldo ante eventos de seguridad"
                        disabled={emailLoading}
                        onClick={handleEmailToggle}
                        className={`flex h-6 w-11 items-center border px-0.5 ${
                          emailLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                        } ${emailSubscribed ? 'border-dg-success bg-dg-success' : 'border-dg-border'}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`h-5 w-5 ${emailSubscribed ? 'translate-x-[18px] bg-dg-bg' : 'bg-dg-text-muted'}`}
                        />
                      </button>
                    )}
                  </div>

                  {/*
                    Aviso sonoro de fraude.

                    En una sala de control el sonido no es un adorno: una
                    alerta solo visual se pierde en cuanto el operador mira a
                    otro lado, que es la mayor parte de su turno. Va apagado
                    por defecto, porque un panel que empieza a pitar sin
                    avisar se silencia para siempre a los cinco minutos.
                  */}
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {sonido ? (
                        <Volume2 className="w-5 h-5 text-dg-success" aria-hidden="true" />
                      ) : (
                        <VolumeX className="w-5 h-5 text-dg-text-muted" aria-hidden="true" />
                      )}
                      <div>
                        <span className="text-sm font-medium">Aviso sonoro de fraude</span>
                        <p className="text-2xs text-dg-text-muted mt-0.5">
                          Suena en este dispositivo al detectarse una suplantación
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={sonido}
                      aria-label="Aviso sonoro de fraude"
                      onClick={() => {
                        const nuevo = !sonido;
                        setSonido(nuevo);
                        activarSonido(nuevo);
                        // Al encenderlo suena una vez: sin oirlo nadie sabe
                        // que ha activado, ni si el dispositivo tiene volumen.
                        if (nuevo) sonarAlerta();
                      }}
                      className={`flex h-6 w-11 cursor-pointer items-center border px-0.5 ${
                        sonido ? 'border-dg-success bg-dg-success' : 'border-dg-border'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-5 w-5 ${sonido ? 'translate-x-[18px] bg-dg-bg' : 'bg-dg-text-muted'}`}
                      />
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              {/* ====== SECCIÓN DE ADMINISTRADORES ====== */}
              <section className="mini-card space-y-5 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-dg-text-secondary" aria-hidden="true" />
                    <h2 className="mini-h2">Administradores</h2>
                  </div>
                  {callerRole === "owner" && (
                    <button
                      onClick={() => { setShowInviteForm(!showInviteForm); setInviteResult(null); }}
                      className="mini-btn flex items-center gap-1.5 px-3 py-1.5 text-2xs"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Invitar
                    </button>
                  )}
                </div>

                {/* Formulario de invitación (solo owner) */}
                {callerRole === "owner" && (
                  <>
                    {showInviteForm && (
                      <form onSubmit={handleInvite}>
                        <div className="flex gap-2 pt-1">
                          <div className="relative flex-1">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-dg-text-muted w-4 h-4" />
                            <input
                              id="invitar-email"
                              type="email"
                              autoComplete="email"
                              aria-label="Correo del nuevo administrador"
                              placeholder="correo@ejemplo.com"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              required
                              disabled={inviteLoading}
                              className="w-full border border-dg-border bg-transparent py-2.5 pl-10 pr-4 text-base text-dg-text placeholder:text-dg-text-muted focus:border-dg-text disabled:opacity-50"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={inviteLoading || !inviteEmail.trim()}
                            className="mini-btn flex items-center gap-2 border-dg-text px-4 py-2.5 text-sm text-dg-text disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {inviteLoading ? "Enviando" : "Enviar"}
                          </button>
                        </div>
                        <p className="mt-2 text-2xs text-dg-text-muted">
                          Se enviará un correo de invitación. El nuevo admin establecerá su contraseña desde el enlace.
                        </p>
                      </form>
                    )}
                  </>
                )}

                {/* Lista de administradores */}
                {adminsLoading ? (
                  <p role="status" className="py-8 text-center text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted">
                    Cargando
                  </p>
                ) : adminsError ? (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-sm text-dg-error">{adminsError}</p>
                    <button
                      onClick={cargarAdmins}
                      className="text-xs font-bold text-dg-action-text hover:underline"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {admins.map((admin) => (
                      <div
                        key={admin.id}
                        className="group flex items-center justify-between border border-dg-border p-3 hover:bg-white/5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center border text-xs font-bold ${
                            admin.id === callerId
                              ? "border-dg-action-text/50 text-dg-action-text"
                              : "border-dg-border text-dg-text-muted"
                          }`}>
                            {admin.email?.charAt(0).toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-dg-text truncate">{admin.email}</p>
                              {admin.id === callerId && (
                                <span className="border border-dg-info/50 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-[0.8px] text-dg-info">
                                  Tú
                                </span>
                              )}
                              {admin.role === "owner" && (
                                <span className="border border-dg-warning/50 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-[0.8px] text-dg-warning">
                                  Propietario
                                </span>
                              )}
                              {!admin.confirmed && (
                                <span className="border border-dg-warning/50 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-[0.8px] text-dg-warning">
                                  Pendiente
                                </span>
                              )}
                            </div>
                            <p className="text-2xs text-dg-text-muted">
                              Último acceso: {formatAdminDate(admin.last_sign_in_at)}
                            </p>
                          </div>
                        </div>

                        {/* Botón eliminar (solo owner puede eliminar, y no a sí mismo) */}
                        {callerRole === "owner" && admin.id !== callerId && (
                          <div className="flex items-center">
                            {confirmDeleteId === admin.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(admin.id)}
                                  disabled={deletingId === admin.id}
                                  className="border border-dg-error/50 px-2 py-1 text-2xs font-bold uppercase tracking-[0.8px] text-dg-error hover:bg-dg-error hover:text-dg-bg disabled:opacity-50"
                                >
                                  {deletingId === admin.id ? "···" : "Confirmar"}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 text-2xs font-bold uppercase tracking-[0.8px] text-dg-text-muted hover:text-dg-text"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(admin.id)}
                                aria-label={`Eliminar al administrador ${admin.email}`}
                                className="p-1.5 text-dg-text-muted/50 opacity-0 hover:text-dg-error group-hover:opacity-100 focus-visible:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    <p className="pt-2 text-center text-2xs uppercase tracking-[0.8px] text-dg-text-muted">
                      {admins.length} administrador{admins.length !== 1 ? "es" : ""} registrado{admins.length !== 1 ? "s" : ""}
                    </p>

                    {/* Botón de configuración inicial: reclamar propiedad (solo si no hay owner) */}
                    {!admins.some((a) => a.role === "owner") && (
                      <button
                        onClick={async () => {
                          setSettingOwner(true);
                          const result = await establecerPropietario();
                          if (result.success) {
                            setInviteResult({ type: "success", message: "Ahora eres el propietario del sistema" });
                            cargarAdmins();
                          } else {
                            setInviteResult({ type: "error", message: result.error ?? "Error estableciendo propietario" });
                          }
                          setSettingOwner(false);
                          setTimeout(() => setInviteResult(null), 5000);
                        }}
                        disabled={settingOwner}
                        className="w-full border border-dg-warning/50 py-3 text-2xs font-bold uppercase tracking-[0.8px] text-dg-warning hover:bg-dg-warning hover:text-dg-bg disabled:opacity-50"
                      >
                        {settingOwner ? "Configurando..." : "Reclamar Propiedad del Sistema"}
                      </button>
                    )}
                  </div>
                )}
              </section>

              <section className="mini-card space-y-4 p-5">
                <h2 className="mini-h2">Información Técnica</h2>
                <div className="border border-dg-border">
                  <table className="w-full text-left text-xs">
                    <tbody className="divide-y divide-dg-border">
                      <TechRow label="Anti-spoofing" value={estado?.antispoofing_activo ? "ACTIVO" : "INACTIVO"} highlight={estado?.antispoofing_activo} />
                      <TechRow label="Tolerancia facial" value={String(estado?.tolerancia_facial ?? "—")} />
                      <TechRow label="Umbral varianza" value={String(estado?.umbral_varianza ?? "—")} />
                      <TechRow label="Cooldown eventos" value={`${estado?.cooldown_eventos ?? "—"}s`} />
                      <TechRow label="Cámaras" value={`${estado?.camaras?.length ?? 0} conectadas`} />
                    </tbody>
                  </table>
                </div>
              </section>


            </div>
          </div>
        )}

        {confirmLogout ? (
          <div
            role="alertdialog"
            aria-labelledby="logout-titulo"
            className="mx-auto w-full max-w-md space-y-3 border border-dg-error/50 p-4"
          >
            <p id="logout-titulo" className="text-center text-sm font-bold uppercase tracking-[0.8px] text-dg-text">
              ¿Cerrar la sesión?
            </p>
            <p className="text-xs text-dg-text-secondary text-center">
              Tendrá que volver a introducir sus credenciales para entrar.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmLogout(false)}
                className="mini-btn flex-1 py-3 text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 border border-dg-error bg-dg-error py-3 text-sm font-bold uppercase tracking-[0.8px] text-dg-bg hover:brightness-110"
              >
                Sí, cerrar sesión
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setConfirmLogout(true)}
            className="mx-auto flex w-full max-w-md items-center justify-center gap-3 border border-dg-error/50 py-4 text-dg-error hover:bg-dg-error hover:text-dg-bg"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-bold uppercase tracking-[0.8px]">Cerrar Sesión</span>
          </button>
        )}
      </main>

      <Navigation variante="minimal" />
    </div>
  );
}

function StatusRow({ label, icon: Icon, connected }: { label: string, icon: any, connected: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-dg-text-muted" aria-hidden="true" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className={`flex items-center gap-2 border px-2 py-1 ${connected ? 'border-dg-success/50' : 'border-dg-error/50'}`}>
        {/* Punto cuadrado y quieto: antes latia en bucle. */}
        <span aria-hidden="true" className={`h-1.5 w-1.5 ${connected ? 'bg-dg-success' : 'bg-dg-error'}`} />
        <span className={`text-2xs font-bold uppercase tracking-[0.8px] ${connected ? 'text-dg-success' : 'text-dg-error'}`}>
          {connected ? "Conectado" : "Desconectado"}
        </span>
      </div>
    </div>
  );
}

function TechRow({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <tr>
      <td className="p-3 text-dg-text-muted">{label}</td>
      <td className={`p-3 text-right ${highlight ? 'text-2xs font-bold uppercase tracking-[0.8px] text-dg-success' : 'font-medium'}`}>{value}</td>
    </tr>
  );
}
