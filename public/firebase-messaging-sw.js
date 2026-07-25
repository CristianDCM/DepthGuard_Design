// firebase-messaging-sw.js
// Service Worker para notificaciones push en segundo plano (FCM).
// Este archivo DEBE estar en la raíz del sitio (/firebase-messaging-sw.js).
//
// NOTA: La config de Firebase aquí está hardcodeada porque los Service Workers
// no pueden usar import.meta.env. Esto es seguro — la config de Firebase es
// pública por diseño (solo identifica el proyecto, no da acceso).

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
// Notificación en segundo plano
// (cuando la app NO está en primer plano)
// ==============================================
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Push recibido en background:", payload);

  const data = payload.data || {};
  const notification = payload.notification || {};

  const title = notification.title || "DepthGuard";
  const options = {
    body: notification.body || "Nuevo evento de seguridad",
    icon: "/favicon.svg",
    badge: "/favicon.png",
    tag: data.event_id || "depthguard-notification",
    renotify: true,
    data: {
      event_id: data.event_id,
      event_type: data.event_type,
      url: data.event_id ? `/event/${data.event_id}` : "/dashboard",
    },
    actions: [
      { action: "open", title: "Ver detalle" },
      { action: "dismiss", title: "Descartar" },
    ],
  };

  self.registration.showNotification(title, options);
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
