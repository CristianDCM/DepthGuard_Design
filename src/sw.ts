/// <reference lib="webworker" />
/* eslint-disable no-restricted-globals */

/**
 * Service Worker único de DepthGuard.
 *
 * Antes el único Service Worker era `firebase-messaging-sw.js`, que solo
 * atiende notificaciones push: sin precaché, sin app shell y sin estrategia
 * de red. Instalada como aplicación y sin conexión, la PWA daba una pantalla
 * en blanco — justo en un sistema Edge-to-Cloud, donde perder la red es el
 * escenario esperado, no la excepción.
 *
 * Dos Service Workers no pueden convivir en el mismo ámbito: el segundo
 * `register()` sustituye al primero. Por eso este importa al de Firebase en
 * lugar de reemplazarlo, y aquel sigue siendo byte a byte el mismo fichero
 * que cubren sus pruebas.
 */

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

/*
 * Lógica de notificaciones push, sin modificar.
 *
 * Va dentro de un try/catch porque `firebase-messaging-sw.js` empieza a su
 * vez con un `importScripts()` al SDK alojado en gstatic.com. Si esa descarga
 * falla — red corporativa que bloquea el dominio, corte pasajero, cualquier
 * cosa — la excepción se propaga y el navegador descarta el Service Worker
 * ENTERO: se perderían también el precaché y el modo sin conexión, que no
 * tienen nada que ver con las notificaciones.
 *
 * Verificado: sin este try/catch el registro falla con "ServiceWorker script
 * evaluation failed" y la PWA se queda sin Service Worker de ningún tipo.
 */
let pushDisponible = true;
try {
  importScripts("/firebase-messaging-sw.js");
} catch (e) {
  pushDisponible = false;
  console.warn("[sw] Notificaciones push no disponibles; el modo sin conexión sigue activo.", e);
}

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

/**
 * Navegación: cualquier ruta cae en el index precacheado, que es lo que
 * convierte "sin conexión" en una pantalla de la aplicación en lugar de en
 * el dinosaurio del navegador.
 */
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("index.html"), {
    denylist: [/^\/firebase-messaging-sw\.js$/, /^\/api\//],
  })
);

/** Tipografías: inmutables y con hash en la ruta. */
registerRoute(
  ({ request, url }) => request.destination === "font" || url.pathname.startsWith("/fonts/"),
  new CacheFirst({
    cacheName: "dg-fuentes",
    plugins: [new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 })],
  })
);

/*
 * NO se cachean las respuestas de Supabase, a propósito.
 *
 * Son datos de seguridad asociados a una sesión: registros de acceso, nombres
 * de personas, capturas. Guardarlos en CacheStorage los deja legibles en el
 * dispositivo después de cerrar sesión y para cualquier otra cuenta que entre
 * luego, y además invita a mostrar un historial viejo como si fuera el actual
 * —exactamente el problema de falsa confianza que resuelve el indicador de
 * frescura—. Lo que se precachea es la aplicación, no lo que dice.
 */

self.addEventListener("message", (event) => {
  if (event.data?.type === "ESTADO") {
    event.ports[0]?.postMessage({ pushDisponible });
  }
  // La página pide activar la versión nueva cuando el usuario acepta.
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
