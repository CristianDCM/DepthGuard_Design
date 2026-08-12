// supabase/functions/notify-event/index.ts
// Edge Function: Enviar notificación push (FCM) + email (Resend) + Telegram
// cuando se inserta un evento de seguridad en la tabla historial.
//
// Invocada por: Database Webhook (INSERT en historial)
// Secrets necesarios:
//   FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY
//   RESEND_API_KEY
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-inyectados)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// ==============================================
// Tipos
// ==============================================

interface HistorialRecord {
  id: string;
  estado: "ACCESO_PERMITIDO" | "FRAUDE" | "DESCONOCIDO";
  nombre: string | null;
  usuario_id: string | null;
  confianza: number | null;
  foto_url: string | null;
  motivo: string | null;
  camera_id: string | null;
  camera_type: string | null;
  timestamp: string;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: HistorialRecord;
  old_record: HistorialRecord | null;
}

// ==============================================
// Utilidades de respuesta
// ==============================================

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// ==============================================
// Google OAuth2: generar access token desde service account
// ==============================================

async function getGoogleAccessToken(): Promise<string> {
  const clientEmail = Deno.env.get("FCM_CLIENT_EMAIL")!;
  const privateKeyPem = Deno.env.get("FCM_PRIVATE_KEY")!.replace(/\\n/g, "\n");

  // Preparar el JWT
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  // Base64url encode
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = b64url(header);
  const claimsB64 = b64url(claims);
  const unsignedToken = `${headerB64}.${claimsB64}`;

  // Importar la clave privada RSA
  const pemBody = privateKeyPem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Firmar
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${signatureB64}`;

  // Intercambiar JWT por access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Error obteniendo access token de Google: ${errText}`);
  }

  const { access_token } = await tokenRes.json();
  return access_token;
}

// ==============================================
// Enviar notificación FCM
// ==============================================

async function sendFCM(
  accessToken: string,
  token: string,
  title: string,
  body: string,
  eventId: string,
  eventType: string
): Promise<{ success: boolean; expired: boolean }> {
  const projectId = Deno.env.get("FCM_PROJECT_ID")!;

  const res = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          webpush: {
            fcm_options: {
              link: `/event/${eventId}`,
            },
          },
          data: {
            event_id: eventId,
            event_type: eventType,
          },
        },
      }),
    }
  );

  if (res.ok) return { success: true, expired: false };

  // Si el token expiró o es inválido, marcarlo para eliminación
  const errorBody = await res.json().catch(() => ({}));
  const errorCode = errorBody?.error?.details?.[0]?.errorCode;
  const isExpired =
    res.status === 404 ||
    res.status === 410 ||
    errorCode === "UNREGISTERED";

  console.warn(`[FCM] Error enviando a token: ${res.status}`, errorBody);
  return { success: false, expired: isExpired };
}

// ==============================================
// Enviar email vía Resend
// ==============================================

async function sendEmail(
  to: string,
  subject: string,
  evento: HistorialRecord
): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.warn("[Email] RESEND_API_KEY no configurada, omitiendo email.");
    return false;
  }

  const colorEstado = evento.estado === "FRAUDE" ? "#ef4444" : "#f59e0b";
  const labelEstado =
    evento.estado === "FRAUDE" ? "FRAUDE DETECTADO" : "PERSONA DESCONOCIDA";
  const appUrl = "https://depthguard.app";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <!-- Header -->
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#ffffff;font-size:22px;margin:0;">
        Depth<span style="color:#a3ff00;">Guard</span>
      </h1>
      <p style="color:#6b7280;font-size:12px;margin:4px 0 0;">Sistema de Control de Acceso 3D</p>
    </div>

    <!-- Alerta -->
    <div style="background:#111827;border:1px solid ${colorEstado}33;border-radius:12px;padding:24px;margin-bottom:24px;">
      <h2 style="color:${colorEstado};text-align:center;font-size:18px;margin:0 0 16px;text-transform:uppercase;letter-spacing:2px;">
        ${labelEstado}
      </h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#9ca3af;padding:6px 0;font-size:13px;">Cámara</td>
          <td style="color:#ffffff;padding:6px 0;font-size:13px;text-align:right;">${evento.camera_id ?? "N/A"}</td>
        </tr>
        <tr>
          <td style="color:#9ca3af;padding:6px 0;font-size:13px;">Persona</td>
          <td style="color:#ffffff;padding:6px 0;font-size:13px;text-align:right;">${evento.nombre ?? "Sin identificar"}</td>
        </tr>
        <tr>
          <td style="color:#9ca3af;padding:6px 0;font-size:13px;">Confianza</td>
          <td style="color:#ffffff;padding:6px 0;font-size:13px;text-align:right;">${evento.confianza ? `${Math.round(evento.confianza * 100)}%` : "N/A"}</td>
        </tr>
        <tr>
          <td style="color:#9ca3af;padding:6px 0;font-size:13px;">Motivo</td>
          <td style="color:#ffffff;padding:6px 0;font-size:13px;text-align:right;">${evento.motivo ?? "—"}</td>
        </tr>
        <tr>
          <td style="color:#9ca3af;padding:6px 0;font-size:13px;">Hora</td>
          <td style="color:#ffffff;padding:6px 0;font-size:13px;text-align:right;">${new Date(evento.timestamp).toLocaleString("es-CO", { timeZone: "America/Bogota" })}</td>
        </tr>
      </table>
    </div>

    <!-- Botón -->
    <div style="text-align:center;">
      <a href="${appUrl}/event/${evento.id}" 
         style="display:inline-block;background:#a3ff00;color:#0a0f1a;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">
        Ver Evento
      </a>
    </div>

    <!-- Footer -->
    <p style="color:#4b5563;font-size:11px;text-align:center;margin-top:32px;">
      Este email fue enviado automáticamente por DepthGuard.<br>
      No respondas a este correo.
    </p>
  </div>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "DepthGuard <alertas@depthguard.app>",
      to,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[Email] Error enviando a ${to}: ${errText}`);
    return false;
  }

  return true;
}

// ==============================================
// Rate Limiting: cooldowns por tipo+cámara+persona
// ==============================================

// Minutos de silencio después de notificar un evento del mismo tipo+cámara+persona
const COOLDOWN_MINUTOS: Record<string, number> = {
  FRAUDE: 3,       // Fraude: 3 min (misma cámara)
  DESCONOCIDO: 2,  // Desconocido: 2 min (mismo tipo+cámara, sin identidad)
};

/**
 * Construye una clave de cooldown que incluye la identidad cuando está disponible.
 * 
 * Ejemplos:
 *   "FRAUDE:entrada_principal"         → fraude genérico en cámara principal
 *   "DESCONOCIDO:entrada_secundaria"   → desconocido en cámara secundaria
 * 
 * Nota: para DESCONOCIDO no tenemos identidad, así que usamos solo tipo+cámara.
 * Para FRAUDE tampoco, pero es correcto agrupar por cámara (mismo atacante).
 */
function construirClaveCooldown(
  estado: string,
  cameraId: string | null
): string {
  return `${estado}:${cameraId ?? "default"}`;
}

/**
 * Verifica si pasó suficiente tiempo desde la última notificación.
 * 
 * Usa una operación ATÓMICA: un solo upsert con lógica de tiempo en la query.
 * Esto previene race conditions donde 2 eventos simultáneos ambos pasan
 * el cooldown porque leyeron el mismo timestamp viejo.
 * 
 * Estrategia:
 * 1. Intentar INSERT (primera vez para esta clave) → notificar
 * 2. Si ya existe, verificar si último_envio + cooldown < NOW()
 *    - Sí → UPDATE atómico + notificar
 *    - No → en cooldown → skip
 */
async function verificarCooldown(
  supabase: any,
  estado: string,
  cameraId: string | null
): Promise<boolean> {
  const clave = construirClaveCooldown(estado, cameraId);
  const cooldownMin = COOLDOWN_MINUTOS[estado] ?? 3;
  const ahora = new Date().toISOString();

  try {
    // Paso 1: Intentar insertar (primera vez para esta clave)
    const { error: insertError } = await supabase
      .from("notificacion_cooldown")
      .insert({ clave, ultimo_envio: ahora });

    if (!insertError) {
      // Insert exitoso → primera notificación para esta clave → enviar
      return true;
    }

    // Si el error NO es de duplicado, algo inesperado pasó → notificar por seguridad
    const isDuplicate =
      insertError.code === "23505" ||
      insertError.message?.includes("duplicate") ||
      insertError.message?.includes("unique");

    if (!isDuplicate) {
      console.warn("[Cooldown] Error inesperado en insert:", insertError);
      return true; // Ante la duda, notificar
    }

    // Paso 2: La clave ya existe → UPDATE atómico SOLO si pasó el cooldown
    // El WHERE con último_envio < threshold hace que solo UNA invocación
    // concurrente gane el UPDATE (las demás obtienen 0 rows affected)
    const threshold = new Date(Date.now() - cooldownMin * 60_000).toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("notificacion_cooldown")
      .update({ ultimo_envio: ahora })
      .eq("clave", clave)
      .lt("ultimo_envio", threshold)
      .select("clave");

    if (updateError) {
      console.warn("[Cooldown] Error en update atómico:", updateError);
      return true; // Ante la duda, notificar
    }

    // Si el UPDATE afectó 1 row → cooldown expirado → notificar
    // Si afectó 0 rows → aún en cooldown → skip
    return (updated && updated.length > 0);
  } catch (err) {
    // Si la tabla no existe o hay error de red, notificar de todos modos
    // para no perder alertas críticas de seguridad
    console.warn("[Cooldown] Error verificando cooldown:", err);
    return true;
  }
}

// ==============================================
// Handler principal
// ==============================================

Deno.serve(async (req: Request) => {
  try {
    const payload: WebhookPayload = await req.json();

    // Validar que es un INSERT en historial
    if (payload.type !== "INSERT" || payload.table !== "historial") {
      return json({ message: "Ignorado: no es INSERT en historial" });
    }

    const evento = payload.record;

    // Solo notificar FRAUDE y DESCONOCIDO
    if (evento.estado === "ACCESO_PERMITIDO") {
      return json({ message: "Ignorado: ACCESO_PERMITIDO no genera notificación" });
    }

    // Cliente Supabase con service_role (bypasea RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ============ RATE LIMITING ============
    // Verificar cooldown ANTES de enviar cualquier notificación
    const debeNotificar = await verificarCooldown(
      supabase,
      evento.estado,
      evento.camera_id
    );

    if (!debeNotificar) {
      return json({
        message: `Rate limited: ${evento.estado}:${evento.camera_id} en cooldown`,
        skipped: true,
      });
    }

    // Preparar contenido de notificación
    const titulo =
      evento.estado === "FRAUDE"
        ? "⚠️ Fraude Detectado"
        : "👤 Persona Desconocida";

    const cuerpo = [
      evento.camera_id ? `Cámara: ${evento.camera_id}` : null,
      evento.nombre ? `Persona: ${evento.nombre}` : null,
      evento.confianza
        ? `Confianza: ${Math.round(evento.confianza * 100)}%`
        : null,
    ]
      .filter(Boolean)
      .join(" | ") || "Nuevo evento de seguridad";

    const results = { push: { sent: 0, failed: 0, cleaned: 0 }, email: { sent: 0, failed: 0 }, telegram: { sent: 0, failed: 0 } };

    // ============ CANAL 1: Push FCM ============
    try {
      const accessToken = await getGoogleAccessToken();

      const { data: suscripciones } = await supabase
        .from("suscripciones_push")
        .select("id, token_fcm");

      if (suscripciones && suscripciones.length > 0) {
        const expiredIds: string[] = [];

        await Promise.allSettled(
          suscripciones.map(async (sub: { id: string; token_fcm: string }) => {
            const { success, expired } = await sendFCM(
              accessToken,
              sub.token_fcm,
              titulo,
              cuerpo,
              evento.id,
              evento.estado
            );
            if (success) {
              results.push.sent++;
            } else {
              results.push.failed++;
              if (expired) expiredIds.push(sub.id);
            }
          })
        );

        // Limpiar tokens expirados
        if (expiredIds.length > 0) {
          await supabase
            .from("suscripciones_push")
            .delete()
            .in("id", expiredIds);
          results.push.cleaned = expiredIds.length;
        }
      }
    } catch (pushError) {
      console.error("[Push] Error en canal FCM:", pushError);
    }

    // ============ CANAL 2: Email (Resend) ============
    try {
      // Obtener emails de todos los admins via auth.users
      const { data: { users } } = await supabase.auth.admin.listUsers();

      if (users && users.length > 0) {
        const subject = `[DepthGuard] ${titulo}`;

        await Promise.allSettled(
          users.map(async (user: any) => {
            if (!user.email) return;
            // Verificar si el usuario ha desactivado las notificaciones por email individualmente
            if (user.user_metadata?.email_notifications_active === false) return;
            
            const sent = await sendEmail(user.email, subject, evento);
            if (sent) {
              results.email.sent++;
            } else {
              results.email.failed++;
            }
          })
        );
      }
    } catch (emailError) {
      console.error("[Email] Error en canal email:", emailError);
    }

    // ============ CANAL 3: Telegram ============
    try {
      const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

      if (botToken && chatId) {
        const emoji = evento.estado === "FRAUDE" ? "\u26a0\ufe0f" : "\ud83d\udc64";
        const hora = new Date(evento.timestamp).toLocaleString("es-CO", {
          timeZone: "America/Bogota",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const texto = [
          `${emoji} <b>${titulo}</b>`,
          "",
          `<b>Camara:</b> ${evento.camera_id ?? "N/A"}`,
          evento.nombre ? `<b>Persona:</b> ${evento.nombre}` : null,
          evento.confianza ? `<b>Confianza:</b> ${Math.round(evento.confianza * 100)}%` : null,
          evento.motivo ? `<b>Motivo:</b> ${evento.motivo}` : null,
          `<b>Hora:</b> ${hora}`,
          "",
          `<a href="https://depthguard.app/event/${evento.id}">Ver evento</a>`,
        ]
          .filter((line) => line !== null)
          .join("\n");

        const tgRes = await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: texto,
              parse_mode: "HTML",
              disable_web_page_preview: true,
            }),
          }
        );

        if (tgRes.ok) {
          results.telegram.sent++;
        } else {
          results.telegram.failed++;
          console.error("[Telegram] Error:", await tgRes.text());
        }
      }
    } catch (tgError) {
      console.error("[Telegram] Error en canal Telegram:", tgError);
    }

    return json({ success: true, evento: evento.id, results });
  } catch (err) {
    console.error("[notify-event] Error general:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
