// src/lib/firebase.ts
// Inicialización de Firebase — solo módulo de Messaging (push notifications).
// La config de Firebase es pública por diseño (identifica el proyecto, no da acceso).
// Ref: https://firebase.google.com/docs/web/learn-more#config-object

import { initializeApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAe9OUBTWpqQCNMUlzCnw9iECmfrxGkDZE",
  authDomain: "depthguard.firebaseapp.com",
  projectId: "depthguard",
  storageBucket: "depthguard.firebasestorage.app",
  messagingSenderId: "838319314545",
  appId: "1:838319314545:web:53c59437ee6eba1c75edd0",
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
export const VAPID_KEY = "BMip5x0j0fL6fm8etpS70pbb-wehWOu1vyBoUoZjdux_h53L6WdiiLcje638ec73ZVrNQPl54Hl7Nuw12Cgr96g";
