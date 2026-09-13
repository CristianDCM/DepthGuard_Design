// firebase-messaging-sw.js
// Service Worker para notificaciones push en segundo plano (FCM).
// Este archivo DEBE estar en la raíz del sitio (/firebase-messaging-sw.js).
//
// NOTA: La config de Firebase aquí está hardcodeada porque los Service Workers
// no pueden usar import.meta.env. Esto es seguro — la config de Firebase es
// pública por diseño (solo identifica el proyecto, no da acceso).
//
// IMPORTANTE (notificaciones duplicadas):
// El SDK de Firebase, al recibir un push que trae bloque `notification`,
// muestra la notificación automáticamente Y ADEMÁS invoca onBackgroundMessage.
// Si el handler vuelve a llamar showNotification(), el usuario recibe DOS
// notificaciones del mismo evento. Por eso el backend envía mensajes
// "data-only" (sin bloque `notification`) y este Service Worker es el ÚNICO
// que muestra la notificación.

importScripts("https://www.gstatic.com/firebasejs/11.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.8.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAe9OUBTWpqQCNMUlzCnw9iECmfrxGkDZE",
  authDomain: "depthguard.firebaseapp.com",
  projectId: "depthguard",
  storageBucket: "depthguard.firebasestorage.app",
  messagingSenderId: "838319314545",
  appId: "1:838319314545:web:53c59437ee6eba1c75edd0",
});

const messaging = firebase.messaging();

// ==============================================
// Activación inmediata de la versión nueva del SW
// Sin esto, un dispositivo con la PWA instalada seguiría ejecutando el SW
// antiguo (el que duplicaba notificaciones) hasta cerrar todas las pestañas.
// ==============================================
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// ==============================================
// Deduplicación
// Segunda línea de defensa: si por cualquier motivo el mismo evento llega
// dos veces (token FCM duplicado del mismo dispositivo, reintento de FCM,
// webhook disparado dos veces), solo se muestra una notificación.
// ==============================================
const VENTANA_DEDUPE_MS = 60_000;
const notificadosRecientemente = new Map();

function yaNotificado(clave) {
  const ahora = Date.now();
  for (const [k, t] of notificadosRecientemente) {
    if (ahora - t > VENTANA_DEDUPE_MS) notificadosRecientemente.delete(k);
  }
  if (notificadosRecientemente.has(clave)) return true;
  notificadosRecientemente.set(clave, ahora);
  return false;
}

// ==============================================
// Notificación en segundo plano
// (cuando la app NO está en primer plano)
// ==============================================
messaging.onBackgroundMessage(async (payload) => {
  const data = payload.data || {};
  // Compatibilidad hacia atrás: si algún mensaje antiguo aún trae `notification`,
  // el SDK ya lo mostró él mismo, así que no lo mostramos otra vez.
  if (payload.notification) return;

  const eventId = data.event_id || "";
  const tag = eventId ? `depthguard-event-${eventId}` : "depthguard-notification";

  if (yaNotificado(tag)) return;

  // Si ya hay una notificación visible de este mismo evento, no mostrar otra.
  const existentes = await self.registration.getNotifications({ tag });
  if (existentes.length > 0) return;

  const title = data.title || "DepthGuard";
  const options = {
    body: data.body || "Nuevo evento de seguridad",
    icon: "/favicon.svg",
    badge: "/favicon.png",
    tag,
    // renotify:false → si llega un duplicado, reemplaza en silencio
    // en lugar de volver a sonar/vibrar.
    renotify: false,
    data: {
      event_id: eventId,
      event_type: data.event_type,
      url: data.url || (eventId ? `/event/${eventId}` : "/dashboard"),
    },
    actions: [
      { action: "open", title: "Ver detalle" },
      { action: "dismiss", title: "Descartar" },
    ],
  };

  await self.registration.showNotification(title, options);
});

// ==============================================
// Click en la notificación
// ==============================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/dashboard";

  // Intentar enfocar una ventana existente, o abrir una nueva
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una ventana abierta de la app, navegar a la URL
        for (const client of clientList) {
          if (client.url.includes(self.registration.scope)) {
            client.navigate(url);
            return client.focus();
          }
        }
        // Si no hay ventana abierta, abrir una nueva
        return self.clients.openWindow(url);
      })
  );
});
