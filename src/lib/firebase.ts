// src/lib/firebase.ts
// Inicialización de Firebase — solo módulo de Messaging (push notifications).
// La config de Firebase es pública por diseño (identifica el proyecto, no da acceso).

import { initializeApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

/**
 * Instancia de Firebase Messaging.
 * Se obtiene de forma lazy porque no todos los navegadores soportan
 * la Push API (ej: navegadores privados, iOS sin PWA instalada).
 * 
 * Retorna null si el navegador no soporta messaging.
 */
export async function getFirebaseMessaging() {
  const supported = await isSupported();
  if (!supported) return null;
  return getMessaging(app);
}

/** VAPID key para Web Push (se usa al solicitar el token FCM) */
export const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
