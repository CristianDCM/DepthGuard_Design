import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Settings as SettingsIcon, Server, Video, Bell, Database, Shield, LogOut, UserPlus, Trash2, Mail, CheckCircle, XCircle, Users, BellRing, BellOff, Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Navigation from "../components/Navigation";
import { getEstadoSistema, isEdgeOnline, isCamaraActiva, logoutAdmin, listarAdmins, invitarAdmin, eliminarAdmin, establecerPropietario, type EstadoSistema, type AdminUser, getEmailNotificationPreference, toggleEmailNotifications } from "../lib/supabase";
import { subscribeToPush, unsubscribeFromPush, getPushStatus, isSubscribed, type PushStatus } from "../lib/pushNotifications";

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
    });
  }

  return (
    <div className="min-h-screen pb-24 flex flex-col bg-dg-bg">
      <header className="sticky top-0 z-50 bg-dg-bg/80 backdrop-blur-md border-b border-dg-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <SettingsIcon className="w-6 h-6 text-dg-accent" />
            <h1 className="text-xl font-bold tracking-tight font-headline">Ajustes</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Mensaje de resultado global */}
        <AnimatePresence>
          {inviteResult && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex items-center gap-3 p-4 rounded-dg border ${
                inviteResult.type === "success"
                  ? "bg-dg-success/10 border-dg-success/30 text-dg-success"
                  : "bg-dg-error/10 border-dg-error/30 text-dg-error"
              }`}
            >
              {inviteResult.type === "success" ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="text-sm font-medium">{inviteResult.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-dg-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <section className="cyber-card p-5 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-dg-accent">Estado del Sistema</h2>
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

              <section className="cyber-card p-5 space-y-5">
                <h2 className="text-xs font-bold uppercase tracking-widest text-dg-accent">Notificaciones</h2>
                <div className="space-y-6">
                  {/* Push Notifications Toggle */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {pushSubscribed ? (
                          <BellRing className="w-5 h-5 text-dg-accent" />
                        ) : (
                          <BellOff className="w-5 h-5 text-dg-text-muted" />
                        )}
                        <div>
                          <span className="text-sm font-medium">Notificaciones Push</span>
                          <p className="text-[10px] text-dg-text-muted mt-0.5">
                            Alertas instantáneas de fraude y accesos desconocidos
                          </p>
                        </div>
                      </div>
                      {pushChecking ? (
                        <div className="w-11 h-6 rounded-full bg-slate-800 flex items-center justify-center">
                          <Loader2 className="w-3 h-3 text-dg-text-muted animate-spin" />
                        </div>
                      ) : pushStatus === "unsupported" ? (
                        <span className="text-[10px] text-dg-text-muted bg-slate-800 px-2 py-1 rounded-full">No soportado</span>
                      ) : (
                        <div
                          onClick={pushLoading ? undefined : handlePushToggle}
                          className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                            pushLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                          } ${pushSubscribed ? 'bg-dg-accent' : 'bg-slate-800'}`}
                        >
                          {pushLoading ? (
                            <Loader2 className={`w-5 h-5 animate-spin ${pushSubscribed ? 'translate-x-5 text-dg-bg' : 'text-dg-text-muted'}`} />
                          ) : (
                            <div className={`w-5 h-5 rounded-full transition-transform shadow-sm ${pushSubscribed ? 'translate-x-5 bg-dg-bg' : 'bg-dg-text-muted'}`} />
                          )}
                        </div>
                      )}
                    </div>
                    {pushStatus === "denied" && (
                      <p className="text-[10px] text-dg-error bg-dg-error/10 border border-dg-error/20 rounded-lg px-3 py-2">
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
                        <p className="text-[10px] text-dg-text-muted mt-0.5">
                          Se envía email automáticamente ante eventos de seguridad
                        </p>
                      </div>
                    </div>
                    {emailChecking ? (
                      <div className="w-11 h-6 rounded-full bg-slate-800 flex items-center justify-center">
                        <Loader2 className="w-3 h-3 text-dg-text-muted animate-spin" />
                      </div>
                    ) : (
                      <div
                        onClick={emailLoading ? undefined : handleEmailToggle}
                        className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                          emailLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                        } ${emailSubscribed ? 'bg-dg-accent' : 'bg-slate-800'}`}
                      >
                        {emailLoading ? (
                          <Loader2 className={`w-5 h-5 animate-spin ${emailSubscribed ? 'translate-x-5 text-dg-bg' : 'text-dg-text-muted'}`} />
                        ) : (
                          <div className={`w-5 h-5 rounded-full transition-transform shadow-sm ${emailSubscribed ? 'translate-x-5 bg-dg-bg' : 'bg-dg-text-muted'}`} />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              {/* ====== SECCIÓN DE ADMINISTRADORES ====== */}
              <section className="cyber-card p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-dg-accent" />
                    <h2 className="text-xs font-bold uppercase tracking-widest text-dg-accent">Administradores</h2>
                  </div>
                  {callerRole === "owner" && (
                    <button
                      onClick={() => { setShowInviteForm(!showInviteForm); setInviteResult(null); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dg-accent/10 border border-dg-accent/20 text-[10px] font-bold uppercase tracking-widest text-dg-accent hover:bg-dg-accent/20 transition-all active:scale-95"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Invitar
                    </button>
                  )}
                </div>

                {/* Formulario de invitación (solo owner) */}
                {callerRole === "owner" && (
                  <AnimatePresence>
                    {showInviteForm && (
                      <motion.form
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        onSubmit={handleInvite}
                        className="overflow-hidden"
                      >
                        <div className="flex gap-2 pt-1">
                          <div className="relative flex-1">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-dg-text-muted w-4 h-4" />
                            <input
                              type="email"
                              placeholder="correo@ejemplo.com"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              required
                              disabled={inviteLoading}
                              className="w-full bg-dg-input border border-dg-border text-white rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-dg-accent/50 focus:border-dg-accent placeholder:text-dg-text-muted outline-none transition-all disabled:opacity-50"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={inviteLoading || !inviteEmail.trim()}
                            className="px-4 py-2.5 bg-dg-accent text-dg-bg font-bold text-sm rounded-lg shadow-[0_0_10px_rgba(163,255,0,0.2)] hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {inviteLoading ? (
                              <div className="w-4 h-4 border-2 border-dg-bg border-t-transparent rounded-full animate-spin" />
                            ) : (
                              "Enviar"
                            )}
                          </button>
                        </div>
                        <p className="text-[10px] text-dg-text-muted mt-2">
                          Se enviará un correo de invitación. El nuevo admin establecerá su contraseña desde el enlace.
                        </p>
                      </motion.form>
                    )}
                  </AnimatePresence>
                )}

                {/* Lista de administradores */}
                {adminsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-dg-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : adminsError ? (
                  <div className="text-center py-6 space-y-2">
                    <p className="text-sm text-dg-error">{adminsError}</p>
                    <button
                      onClick={cargarAdmins}
                      className="text-xs font-bold text-dg-accent hover:underline"
                    >
                      Reintentar
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {admins.map((admin) => (
                      <motion.div
                        key={admin.id}
                        layout
                        className="flex items-center justify-between p-3 rounded-lg bg-dg-bg/50 border border-dg-border/50 group hover:border-dg-border transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                            admin.id === callerId
                              ? "bg-dg-accent/15 text-dg-accent border border-dg-accent/30"
                              : "bg-white/5 text-dg-text-muted border border-white/10"
                          }`}>
                            {admin.email?.charAt(0).toUpperCase() ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white truncate">{admin.email}</p>
                              {admin.id === callerId && (
                                <span className="text-[9px] font-bold uppercase tracking-widest text-dg-accent bg-dg-accent/10 px-1.5 py-0.5 rounded">
                                  Tú
                                </span>
                              )}
                              {admin.role === "owner" && (
                                <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                                  Propietario
                                </span>
                              )}
                              {!admin.confirmed && (
                                <span className="text-[9px] font-bold uppercase tracking-widest text-dg-warning bg-dg-warning/10 px-1.5 py-0.5 rounded">
                                  Pendiente
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-dg-text-muted">
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
                                  className="px-2 py-1 text-[10px] font-bold uppercase bg-dg-error/10 border border-dg-error/30 text-dg-error rounded hover:bg-dg-error/20 transition-colors disabled:opacity-50"
                                >
                                  {deletingId === admin.id ? "..." : "Confirmar"}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 text-[10px] font-bold uppercase text-dg-text-muted hover:text-white transition-colors"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(admin.id)}
                                className="p-1.5 text-dg-text-muted/50 hover:text-dg-error transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}

                    <p className="text-center text-[10px] text-dg-text-muted pt-2">
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
                        className="w-full py-3 bg-amber-400/10 border border-amber-400/20 rounded-lg text-[10px] font-bold uppercase tracking-widest text-amber-400 hover:bg-amber-400/20 transition-all active:scale-95 disabled:opacity-50"
                      >
                        {settingOwner ? "Configurando..." : "Reclamar Propiedad del Sistema"}
                      </button>
                    )}
                  </div>
                )}
              </section>

              <section className="cyber-card overflow-hidden p-5 space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-widest text-dg-accent">Información Técnica</h2>
                <div className="rounded-lg overflow-hidden border border-dg-border">
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

        <button 
          onClick={handleLogout}
          className="w-full py-4 rounded-xl border border-dg-error/30 bg-dg-error/5 flex items-center justify-center gap-3 group hover:bg-dg-error/10 transition-colors active:scale-95 max-w-md mx-auto"
        >
          <LogOut className="w-5 h-5 text-dg-error" />
          <span className="text-sm font-bold uppercase tracking-widest text-dg-error">Cerrar Sesión</span>
        </button>
      </main>

      <Navigation />
    </div>
  );
}

function StatusRow({ label, icon: Icon, connected }: { label: string, icon: any, connected: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-dg-text-muted" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className={`flex items-center gap-2 px-2 py-1 rounded-full ${connected ? 'bg-dg-success/10' : 'bg-dg-error/10'}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-dg-success animate-pulse' : 'bg-dg-error'}`} />
        <span className={`text-[10px] font-bold uppercase ${connected ? 'text-dg-success' : 'text-dg-error'}`}>
          {connected ? "Conectado" : "Desconectado"}
        </span>
      </div>
    </div>
  );
}

function ToggleRow({ label, checked: initialChecked }: { label: string, checked?: boolean }) {
  const [isChecked, setIsChecked] = useState(initialChecked || false);

  return (
    <div className="flex justify-between items-center">
      <span className="text-sm font-medium">{label}</span>
      <div 
        onClick={() => setIsChecked(!isChecked)}
        className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${isChecked ? 'bg-dg-accent' : 'bg-slate-800'}`}
      >
        <div className={`w-5 h-5 rounded-full transition-transform shadow-sm ${isChecked ? 'translate-x-5 bg-dg-bg' : 'bg-dg-text-muted'}`} />
      </div>
    </div>
  );
}

function TechRow({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <tr className="bg-dg-bg/30">
      <td className="p-3 text-dg-text-muted">{label}</td>
      <td className={`p-3 text-right ${highlight ? 'font-bold text-dg-success uppercase text-[10px]' : 'font-medium'}`}>{value}</td>
    </tr>
  );
}
