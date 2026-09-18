/**
 * Traducción de errores a mensajes que alguien puede accionar.
 *
 * Hasta ahora la aplicación hacía `setError(err.message)`: al operador le
 * llegaba el texto crudo de Supabase, de fetch o de una DOMException. Un
 * mensaje como "Failed to fetch" o "NotReadableError" no dice qué ha pasado,
 * ni de quién es el problema, ni qué hacer a continuación.
 *
 * Cada error traducido lleva cuatro cosas:
 *   - qué ha pasado, en el idioma de quien usa el sistema
 *   - la causa probable
 *   - qué puede hacer ahora
 *   - un código corto y copiable, para soporte
 */

export type Severidad = "info" | "aviso" | "critico";

export interface AccionError {
  etiqueta: string;
  /** "reintentar" lo resuelve quien llama; "navegar" lleva a `destino`. */
  tipo: "reintentar" | "navegar";
  destino?: string;
}

export interface ErrorUi {
  /** Código corto para soporte. Se muestra en pequeño, se puede copiar. */
  codigo: string;
  severidad: Severidad;
  titulo: string;
  cuerpo: string;
  acciones: AccionError[];
}

/** Dónde ocurrió el fallo, para afinar el mensaje. */
export type Contexto = "camara" | "registro" | "sesion" | "datos" | "informe";

const REINTENTAR: AccionError = { etiqueta: "Reintentar", tipo: "reintentar" };
const VER_SISTEMA: AccionError = { etiqueta: "Ver estado del sistema", tipo: "navegar", destino: "/settings" };
const IR_LOGIN: AccionError = { etiqueta: "Iniciar sesión", tipo: "navegar", destino: "/" };

/** Catálogo de errores conocidos. */
export const ERRORES: Record<string, Omit<ErrorUi, "codigo">> = {
  EDGE_APAGADO: {
    severidad: "critico",
    titulo: "El terminal de acceso está apagado",
    cuerpo: "No se recibe señal del terminal. Compruebe que está encendido y conectado a la red.",
    acciones: [REINTENTAR, VER_SISTEMA],
  },
  CAMARA_DENEGADA: {
    severidad: "aviso",
    titulo: "Permiso de cámara denegado",
    cuerpo:
      "El navegador está bloqueando la cámara. En Chrome, toque el icono de cámara en la barra de direcciones; en iPhone, vaya a Ajustes › Safari › Cámara.",
    acciones: [REINTENTAR],
  },
  CAMARA_NO_ENCONTRADA: {
    severidad: "critico",
    titulo: "No se detecta ninguna cámara",
    cuerpo: "El terminal no tiene ninguna cámara disponible. Compruebe la conexión del sensor.",
    acciones: [REINTENTAR, VER_SISTEMA],
  },
  CAMARA_OCUPADA: {
    severidad: "aviso",
    titulo: "La cámara está en uso",
    cuerpo: "Otro programa la tiene abierta en el terminal. Ciérrelo y vuelva a intentarlo.",
    acciones: [REINTENTAR],
  },
  VIDEO_BLOQUEADO: {
    severidad: "aviso",
    titulo: "La red bloquea el vídeo en directo",
    cuerpo:
      "No se pudo abrir el enlace directo con la cámara, normalmente por el cortafuegos de la red. Se muestra una vista reducida.",
    acciones: [REINTENTAR],
  },
  SIN_CONEXION: {
    severidad: "critico",
    titulo: "Sin conexión",
    cuerpo: "Este dispositivo no tiene acceso a la red. Los datos en pantalla pueden estar desactualizados.",
    acciones: [REINTENTAR],
  },
  SERVIDOR_NO_RESPONDE: {
    severidad: "critico",
    titulo: "No se pudo contactar con el servidor",
    cuerpo: "La petición no llegó a completarse. Puede ser una caída temporal de red.",
    acciones: [REINTENTAR],
  },
  SESION_CADUCADA: {
    severidad: "aviso",
    titulo: "Su sesión ha caducado",
    cuerpo: "Por seguridad, la sesión se cierra tras un tiempo de inactividad.",
    acciones: [IR_LOGIN],
  },
  SIN_PERMISOS: {
    severidad: "aviso",
    titulo: "No tiene permisos para esta acción",
    cuerpo: "Su cuenta no puede realizar esta operación. Pida a un administrador que se la habilite.",
    acciones: [],
  },
  USUARIO_DUPLICADO: {
    severidad: "aviso",
    titulo: "Ese nombre ya está registrado",
    cuerpo: "Ya existe una persona con ese nombre. Revise la lista de usuarios antes de crear otro.",
    acciones: [{ etiqueta: "Ver usuarios", tipo: "navegar", destino: "/users" }],
  },
  VENTANA_BLOQUEADA: {
    severidad: "aviso",
    titulo: "El navegador bloqueó la ventana del informe",
    cuerpo: "Permita las ventanas emergentes para este sitio y vuelva a generar el informe.",
    acciones: [REINTENTAR],
  },
  DESCONOCIDO: {
    severidad: "critico",
    titulo: "Algo no ha salido bien",
    cuerpo: "La operación no pudo completarse. Si vuelve a ocurrir, indique el código a soporte.",
    acciones: [REINTENTAR],
  },
};

const PREFIJO: Record<Contexto | "general", string> = {
  camara: "DG-CAM",
  registro: "DG-REG",
  sesion: "DG-AUT",
  datos: "DG-NET",
  informe: "DG-PDF",
  general: "DG",
};

function codigoDe(clave: string, contexto?: Contexto): string {
  const n = Object.keys(ERRORES).indexOf(clave) + 1;
  return `${PREFIJO[contexto ?? "general"]}-${String(n).padStart(2, "0")}`;
}

/** Nombre de la DOMException, cuando lo haya. */
function nombreDe(e: unknown): string {
  if (e && typeof e === "object" && "name" in e && typeof (e as { name: unknown }).name === "string") {
    return (e as { name: string }).name;
  }
  return "";
}

function textoDe(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return "";
}

/** Código de PostgREST/Postgres, si el error viene de Supabase. */
function codigoPostgrest(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    const c = (e as { code: unknown }).code;
    if (typeof c === "string") return c;
  }
  return "";
}

/**
 * Decide qué error conocido corresponde. Devuelve la clave del catálogo.
 * Se exporta para poder probarla sin construir el objeto entero.
 */
export function clasificar(e: unknown): keyof typeof ERRORES {
  const nombre = nombreDe(e);
  const texto = textoDe(e).toLowerCase();
  const pg = codigoPostgrest(e);

  // Errores de dispositivo: los nombres de DOMException son estables.
  if (nombre === "NotAllowedError" || nombre === "PermissionDeniedError") return "CAMARA_DENEGADA";
  if (nombre === "NotFoundError" || nombre === "DevicesNotFoundError") return "CAMARA_NO_ENCONTRADA";
  if (nombre === "NotReadableError" || nombre === "TrackStartError") return "CAMARA_OCUPADA";
  if (nombre === "OverconstrainedError" || nombre === "ConstraintNotSatisfiedError") return "CAMARA_NO_ENCONTRADA";

  // El navegador declara que no hay red antes de intentar nada.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "SIN_CONEXION";

  // fetch fallido: TypeError con "failed to fetch" / "network".
  if (nombre === "TypeError" && (texto.includes("fetch") || texto.includes("network"))) {
    return "SERVIDOR_NO_RESPONDE";
  }

  // Postgres: violación de unicidad.
  if (pg === "23505" || texto.includes("duplicate key")) return "USUARIO_DUPLICADO";
  // PostgREST: fila no visible por RLS o rol insuficiente.
  if (pg === "42501" || texto.includes("row-level security") || texto.includes("permission denied")) {
    return "SIN_PERMISOS";
  }
  if (pg === "PGRST301" || texto.includes("jwt expired") || texto.includes("token is expired")) {
    return "SESION_CADUCADA";
  }

  if (texto.includes("ventana emergente") || texto.includes("popup")) return "VENTANA_BLOQUEADA";
  if (texto.includes("edge") && texto.includes("activo")) return "EDGE_APAGADO";

  return "DESCONOCIDO";
}

/**
 * Traduce cualquier cosa que se haya lanzado a un error presentable.
 *
 * `clave` fuerza una entrada concreta del catálogo cuando quien llama ya sabe
 * qué ha pasado (por ejemplo, el heartbeat sabe que el edge está apagado).
 */
export function traducirError(
  e: unknown,
  opciones: { contexto?: Contexto; clave?: keyof typeof ERRORES } = {}
): ErrorUi {
  const clave = opciones.clave ?? clasificar(e);
  return { codigo: codigoDe(clave, opciones.contexto), ...ERRORES[clave] };
}
