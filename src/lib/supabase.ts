import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "⚠️ DepthGuard: Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. " +
    "La app no podrá conectarse a la base de datos. " +
    "Configura las variables en Vercel → Settings → Environment Variables."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key"
);

// ============================================
// Tipos basados en el schema de la base de datos
// ============================================

export type EstadoEvento = "ACCESO_PERMITIDO" | "FRAUDE" | "DESCONOCIDO";

/** Identificador de cada cámara en la sede */
export type CameraId = "entrada_principal" | "entrada_secundaria";

/** Tipo de verificación que realiza cada cámara */
export type CameraType = "3D" | "2D";

export interface Usuario {
  id: string;
  nombre: string;
  notas: string;
  activo: boolean;
  num_angulos: number;
  embeddings_json: any;
  foto_perfil: string | null;
  fecha_registro: string;
  created_at: string;
}

export interface Evento {
  id: string;
  estado: EstadoEvento;
  nombre: string | null;
  usuario_id: string | null;
  confianza: number | null;
  foto_url: string | null;
  motivo: string | null;
  // Campos multicámara (opcionales hasta que se ejecute la migración v3)
  camera_id?: CameraId;
  camera_type?: CameraType;
  verification_level?: "3D_antispoofing" | "2D_recognition";
  metricas_json: {
    varianza: number;
    rango_3d: number;
    distancia: number;
    pixeles_validos: number;
  } | null;
  timestamp: string;
}

/** Estado de un comando enviado al edge */
export type EstadoComando = "pendiente" | "en_progreso" | "completado" | "error" | "cancelado";

/** Comando enviado al edge vía tabla comandos_edge */
export interface ComandoEdge {
  id: string;
  tipo: "INICIAR_REGISTRO" | "CANCELAR_REGISTRO";
  usuario_id: string | null;
  nombre: string | null;
  estado: EstadoComando;
  progreso: number;
  resultado: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/** Estado de una cámara individual dentro del nodo edge */
export interface CamaraEstado {
  camera_id: CameraId;
  camera_type: CameraType;
  activa: boolean;
  modelo: string;
}

/** Estado global del nodo edge (PC central) */
export interface EstadoSistema {
  id: number;
  // Campos legacy (mantener para retrocompatibilidad con schema actual)
  camara_activa?: boolean;
  modo_camara?: string;
  // Campos nuevos (arquitectura multicámara)
  ultimo_heartbeat: string | null;
  tolerancia_facial: number;
  umbral_varianza: number;
  cooldown_eventos: number;
  antispoofing_activo: boolean;
  camaras: CamaraEstado[];
  updated_at: string;
}

// ============================================
// Constantes de cámaras
// ============================================

/** Tiempo máximo sin heartbeat para considerar el edge offline (ms) */
export const EDGE_HEARTBEAT_TIMEOUT_MS = 120_000; // 2 minutos

/** Verifica si el nodo edge está online basándose en el último heartbeat */
export function isEdgeOnline(ultimoHeartbeat: string | null): boolean {
  if (!ultimoHeartbeat) return false;
  return (Date.now() - new Date(ultimoHeartbeat).getTime()) < EDGE_HEARTBEAT_TIMEOUT_MS;
}

/**
 * Determina si una cámara está realmente activa.
 * Combina el heartbeat del edge con el campo `activa` de la cámara:
 * - Si el edge está offline (heartbeat vencido), NINGUNA cámara puede estar activa.
 * - Si el edge está online, se usa el valor de `cam.activa` reportado por el heartbeat.
 */
export function isCamaraActiva(cam: CamaraEstado, ultimoHeartbeat: string | null): boolean {
  if (!isEdgeOnline(ultimoHeartbeat)) return false;
  return cam.activa;
}

// Admin type ya no es necesario — Supabase Auth maneja la sesión
// El tipo de usuario de auth es `import { User } from '@supabase/supabase-js'`

// ============================================
// Funciones helper para queries frecuentes
// ============================================

/** Obtener estadísticas del dashboard (conteos de hoy) */
export async function getEstadisticasHoy() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const inicioHoy = hoy.toISOString();

  const [accesos, fraudes, desconocidos, totalUsuarios] = await Promise.all([
    supabase
      .from("historial")
      .select("id", { count: "exact", head: true })
      .eq("estado", "ACCESO_PERMITIDO")
      .gte("timestamp", inicioHoy),
    supabase
      .from("historial")
      .select("id", { count: "exact", head: true })
      .eq("estado", "FRAUDE")
      .gte("timestamp", inicioHoy),
    supabase
      .from("historial")
      .select("id", { count: "exact", head: true })
      .eq("estado", "DESCONOCIDO")
      .gte("timestamp", inicioHoy),
    supabase
      .from("usuarios")
      .select("id", { count: "exact", head: true }),
  ]);

  return {
    accesos: accesos.count ?? 0,
    fraudes: fraudes.count ?? 0,
    desconocidos: desconocidos.count ?? 0,
    totalUsuarios: totalUsuarios.count ?? 0,
  };
}

/** Obtener últimos N eventos */
export async function getUltimosEventos(limit = 10) {
  const { data, error } = await supabase
    .from("historial")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Evento[];
}

/** Obtener historial con filtros */
export async function getHistorial(filtro?: EstadoEvento, busqueda?: string) {
  let query = supabase
    .from("historial")
    .select("*")
    .order("timestamp", { ascending: false });

  if (filtro) {
    query = query.eq("estado", filtro);
  }

  if (busqueda) {
    query = query.or(`nombre.ilike.%${busqueda}%,motivo.ilike.%${busqueda}%`);
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;
  return data as Evento[];
}

/** Obtener evento por ID */
export async function getEventoPorId(id: string) {
  const { data, error } = await supabase
    .from("historial")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Evento;
}

/** Obtener todos los usuarios */
export async function getUsuarios() {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .order("nombre");

  if (error) throw error;
  return data as Usuario[];
}

/** Obtener usuario por ID */
export async function getUsuarioPorId(id: string) {
  const { data, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Usuario;
}

/** Actualizar usuario (notas, activo) */
export async function actualizarUsuario(id: string, cambios: Partial<Pick<Usuario, "notas" | "activo">>) {
  const { data, error } = await supabase
    .from("usuarios")
    .update(cambios)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Usuario;
}

/** Crear nuevo usuario (registro biométrico) */
export async function crearUsuario(nombre: string, notas: string = "") {
  const { data, error } = await supabase
    .from("usuarios")
    .insert({ nombre, notas, activo: true, num_angulos: 0 })
    .select()
    .single();

  if (error) throw error;
  return data as Usuario;
}

/** Actualizar progreso de registro (ángulos capturados) */
export async function actualizarProgresoRegistro(id: string, numAngulos: number) {
  const { data, error } = await supabase
    .from("usuarios")
    .update({ num_angulos: numAngulos })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Usuario;
}

/** Eliminar usuario */
export async function eliminarUsuario(id: string) {
  const { error } = await supabase
    .from("usuarios")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/** Obtener estado del sistema */
export async function getEstadoSistema(): Promise<EstadoSistema> {
  const { data, error } = await supabase
    .from("estado_sistema")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) throw error;

  const raw = data as any;

  // Fallback: si la columna 'camaras' no existe todavía (pre-migración),
  // construir el array a partir de los campos legacy
  const camaras: CamaraEstado[] = raw.camaras ?? [
    {
      camera_id: "entrada_principal" as CameraId,
      camera_type: "3D" as CameraType,
      activa: raw.camara_activa ?? false,
      modelo: raw.modo_camara === "realsense" ? "Intel RealSense" : "Simulada",
    },
  ];

  return { ...raw, camaras } as EstadoSistema;
}

/** Login de admin via Supabase Auth (email/password con bcrypt + JWT) */
export async function loginAdmin(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) return null;
  return data.user;
}

/** Cerrar sesión via Supabase Auth */
export async function logoutAdmin() {
  await supabase.auth.signOut();
}

/** Obtener sesión actual (para ProtectedRoute) */
export async function getSessionActual() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** Contar accesos de un usuario específico */
export async function contarAccesosUsuario(nombre: string) {
  const { count, error } = await supabase
    .from("historial")
    .select("id", { count: "exact", head: true })
    .eq("nombre", nombre)
    .eq("estado", "ACCESO_PERMITIDO");

  if (error) throw error;
  return count ?? 0;
}

/** Obtener últimos eventos de un usuario */
export async function getEventosUsuario(nombre: string, limit = 5) {
  const { data, error } = await supabase
    .from("historial")
    .select("*")
    .eq("nombre", nombre)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Evento[];
}

/** Contar usuarios activos/inactivos */
export async function contarUsuariosPorEstado() {
  const [activos, inactivos] = await Promise.all([
    supabase.from("usuarios").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("usuarios").select("id", { count: "exact", head: true }).eq("activo", false),
  ]);
  return {
    activos: activos.count ?? 0,
    inactivos: inactivos.count ?? 0,
  };
}

/** Contar total de accesos de todos los usuarios */
export async function contarTotalAccesos() {
  const { count, error } = await supabase
    .from("historial")
    .select("id", { count: "exact", head: true })
    .eq("estado", "ACCESO_PERMITIDO");

  if (error) throw error;
  return count ?? 0;
}

// ============================================
// Funciones multicámara
// ============================================

/** Obtener últimos eventos filtrados por cámara */
export async function getEventosPorCamara(cameraId: CameraId, limit = 10) {
  const { data, error } = await supabase
    .from("historial")
    .select("*")
    .eq("camera_id", cameraId)
    .order("timestamp", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Evento[];
}

/** Obtener el último evento de cada cámara (para el Split-Screen) */
export async function getUltimoEventoPorCamara() {
  const [principal, secundaria] = await Promise.all([
    supabase
      .from("historial")
      .select("*")
      .eq("camera_id", "entrada_principal")
      .order("timestamp", { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from("historial")
      .select("*")
      .eq("camera_id", "entrada_secundaria")
      .order("timestamp", { ascending: false })
      .limit(1)
      .single(),
  ]);

  return {
    entrada_principal: (principal.data as Evento) ?? null,
    entrada_secundaria: (secundaria.data as Evento) ?? null,
  };
}

/** Obtener estadísticas de hoy filtradas por cámara */
export async function getEstadisticasHoyPorCamara(cameraId: CameraId) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const inicioHoy = hoy.toISOString();

  const [accesos, fraudes, desconocidos] = await Promise.all([
    supabase
      .from("historial")
      .select("id", { count: "exact", head: true })
      .eq("estado", "ACCESO_PERMITIDO")
      .eq("camera_id", cameraId)
      .gte("timestamp", inicioHoy),
    supabase
      .from("historial")
      .select("id", { count: "exact", head: true })
      .eq("estado", "FRAUDE")
      .eq("camera_id", cameraId)
      .gte("timestamp", inicioHoy),
    supabase
      .from("historial")
      .select("id", { count: "exact", head: true })
      .eq("estado", "DESCONOCIDO")
      .eq("camera_id", cameraId)
      .gte("timestamp", inicioHoy),
  ]);

  return {
    accesos: accesos.count ?? 0,
    fraudes: fraudes.count ?? 0,
    desconocidos: desconocidos.count ?? 0,
  };
}

// ============================================
// Funciones de comandos al Edge (registro)
// ============================================

/** Insertar un comando INICIAR_REGISTRO en la tabla comandos_edge */
export async function insertarComandoRegistro(usuarioId: string, nombre: string): Promise<ComandoEdge> {
  const { data, error } = await supabase
    .from("comandos_edge")
    .insert({
      tipo: "INICIAR_REGISTRO",
      usuario_id: usuarioId,
      nombre: nombre,
      estado: "pendiente",
      progreso: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ComandoEdge;
}

/** Obtener el estado actual de un comando */
export async function getComandoEstado(comandoId: string): Promise<ComandoEdge> {
  const { data, error } = await supabase
    .from("comandos_edge")
    .select("*")
    .eq("id", comandoId)
    .single();

  if (error) throw error;
  return data as ComandoEdge;
}

/** Cancelar un registro en progreso */
export async function cancelarRegistroEdge(usuarioId: string): Promise<void> {
  await supabase
    .from("comandos_edge")
    .insert({
      tipo: "CANCELAR_REGISTRO",
      usuario_id: usuarioId,
      estado: "pendiente",
    });
}

/**
 * Suscribirse a cambios en un comando específico vía Realtime.
 * Retorna la función de cleanup para cancelar la suscripción.
 */
export function suscribirComandoEstado(
  comandoId: string,
  callback: (comando: ComandoEdge) => void
): () => void {
  const channel = supabase
    .channel(`comando-${comandoId}`)
    .on(
      "postgres_changes" as any,
      {
        event: "UPDATE",
        schema: "public",
        table: "comandos_edge",
        filter: `id=eq.${comandoId}`,
      },
      (payload: any) => {
        callback(payload.new as ComandoEdge);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
