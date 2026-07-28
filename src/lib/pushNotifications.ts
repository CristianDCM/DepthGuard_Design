// src/lib/pushNotifications.ts
// Módulo de gestión de suscripciones push (FCM + Supabase).
// Maneja: solicitar permiso, obtener/guardar token, cancelar suscripción,
// escuchar mensajes en primer plano.

import { getToken, deleteToken, onMessage, type Unsubscribe } from "firebase/messaging";
import { supabase } from "./supabase";
import { getFirebaseMessaging, VAPID_KEY } from "./firebase";

export type PushStatus = "granted" | "denied" | "default" | "unsupported";

/**
 * Verifica el estado actual del permiso de notificaciones.
 */
export function getPushStatus(): PushStatus {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as PushStatus;
}

/**
 * Solicita permiso, obtiene el token FCM y lo guarda en Supabase.
 * Retorna el token FCM si fue exitoso, o null si el usuario denegó o hubo error.
 */
export async function subscribeToPush(): Promise<string | null> {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!currentToken) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { error } = await supabase.from("suscripciones_push").upsert(
      {
        token_fcm: currentToken,
        user_id: user.id,
        dispositivo: navigator.userAgent,
      },
      { onConflict: "token_fcm" }
    );

    if (error) return null;

    return currentToken;
  } catch {
    return null;
  }
}

/**
 * Elimina el token de Supabase y revoca la suscripción en Firebase.
 */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return;

    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (currentToken) {
      await supabase.from("suscripciones_push").delete().eq("token_fcm", currentToken);
      await deleteToken(messaging);
    }
  } catch {
    // Silencioso en producción
  }
}

/**
 * Verifica si el usuario actual tiene una suscripción push activa en la BD.
 */
export async function isSubscribed(): Promise<boolean> {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return false;

    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!currentToken) return false;

    const { data } = await supabase
      .from("suscripciones_push")
      .select("id")
      .eq("token_fcm", currentToken)
      .maybeSingle();

    return !!data;
  } catch {
    return false;
  }
}

/**
 * Escucha notificaciones push cuando la app está abierta en primer plano.
 * En este caso Firebase NO muestra notificación nativa automáticamente,
 * así que el callback debe manejar la UI (toast, badge, etc).
 * Retorna una función para cancelar la suscripción.
 */
export async function onForegroundMessage(
  callback: (payload: any) => void
): Promise<Unsubscribe | null> {
  try {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return null;

    return onMessage(messaging, callback);
  } catch {
    return null;
  }
}
