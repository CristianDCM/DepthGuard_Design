import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan variables de entorno VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. " +
    "Copia .env.example a .env.local y configura tus credenciales de Supabase."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================
// Tipos basados en el schema de la base de datos
// ============================================

export type EstadoEvento = "ACCESO_PERMITIDO" | "FRAUDE" | "DESCONOCIDO";

export interface Usuario {
  id: string;
  nombre: string;
  notas: string;
  activo: boolean;
  num_angulos: number;
  embeddings_json: any;
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
  metricas_json: {
    varianza: number;
    rango_3d: number;
    distancia: number;
    pixeles_validos: number;
  } | null;
  timestamp: string;
}

export interface EstadoSistema {
  id: number;
  camara_activa: boolean;
  modo_camara: string;
  ultimo_heartbeat: string | null;
  tolerancia_facial: number;
  umbral_varianza: number;
  cooldown_eventos: number;
  antispoofing_activo: boolean;
  updated_at: string;
}

export interface Admin {
  id: string;
  usuario: string;
  password_hash: string;
  created_at: string;
}

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

/** Eliminar usuario */
export async function eliminarUsuario(id: string) {
  const { error } = await supabase
    .from("usuarios")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/** Obtener estado del sistema */
export async function getEstadoSistema() {
  const { data, error } = await supabase
    .from("estado_sistema")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) throw error;
  return data as EstadoSistema;
}

/** Login de admin (simple, sin hash por ahora) */
export async function loginAdmin(usuario: string, password: string) {
  const { data, error } = await supabase
    .from("admin")
    .select("*")
    .eq("usuario", usuario)
    .single();

  if (error || !data) return null;
  
  // TODO: Implementar hash comparison (PBKDF2 o bcrypt)
  // Por ahora comparación directa para desarrollo
  if (data.password_hash === password) {
    return data as Admin;
  }
  return null;
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
