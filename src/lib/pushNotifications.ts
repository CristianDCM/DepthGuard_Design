// src/lib/pushNotifications.ts
// Módulo de gestión de suscripciones push (FCM + Supabase).
// Maneja: solicitar permiso, obtener/guardar token, cancelar suscripción,
// escuchar mensajes en primer plano.

import { getToken, deleteToken, onMessage, type Unsubscribe } from "firebase/messaging";
import { supabase } from "./supabase";
import { getFirebaseMessaging, VAPID_KEY } from "./firebase";

export type PushStatus = "granted" | "denied" | "default" | "unsupported";

/**
 * Ruta del Service Worker de la aplicación.
 *
 * Es el Service Worker ÚNICO: atiende el precaché offline y, mediante
 * `importScripts("/firebase-messaging-sw.js")`, también las notificaciones
 * push. Antes se registraba aquí el de Firebase directamente, pero dos
 * Service Workers no pueden convivir en el mismo ámbito — el segundo
 * `register()` sustituye al primero — así que uno de los dos se perdía.
 */
const SW_URL = "/sw.js";

/**
 * Obtiene el registro del Service Worker de FCM.
 *
 * Se lo pasamos explícitamente a getToken() para que el SDK de Firebase NO
 * cree su propio registro en paralelo. Con dos registros activos el mismo
 * dispositivo puede acabar con dos suscripciones push y recibir la
 * notificación duplicada.
 */
async function getSwRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    // register() es idempotente: si ya existe, devuelve el registro existente.
    const registration = await navigator.serviceWorker.register(SW_URL);
    // Esperar a que haya un SW activo antes de pedir el token.
    await navigator.serviceWorker.ready;
    return registration;
  } catch {
    return null;
  }
}

/**
 * Obtiene el token FCM actual usando el Service Worker ya registrado.
 */
async function getCurrentToken(): Promise<string | null> {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return null;

  const registration = await getSwRegistration();
  if (!registration) return null;

  return await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
}

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

    const currentToken = await getCurrentToken();
    if (!currentToken) return null;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const dispositivo = navigator.userAgent;

    const { error } = await supabase.from("suscripciones_push").upsert(
      {
        token_fcm: currentToken,
        user_id: user.id,
        dispositivo,
      },
      { onConflict: "token_fcm" }
    );

    if (error) return null;

    // Limpiar tokens antiguos de ESTE mismo dispositivo.
    // Al reinstalar la PWA, borrar datos del sitio o rotar el token FCM,
    // la fila anterior queda huérfana pero sigue siendo entregable durante
    // un tiempo: el teléfono recibiría la misma notificación dos veces.
    await supabase
      .from("suscripciones_push")
      .delete()
      .eq("user_id", user.id)
      .eq("dispositivo", dispositivo)
      .neq("token_fcm", currentToken);

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

    const currentToken = await getCurrentToken();
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
    const currentToken = await getCurrentToken();
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
