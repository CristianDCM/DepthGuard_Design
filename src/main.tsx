import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {SpeedInsights} from '@vercel/speed-insights/react';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <SpeedInsights />
  </StrictMode>,
);

// Registrar Service Worker para notificaciones push (FCM)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/firebase-messaging-sw.js')
    .then((reg) => console.log('[SW] Registrado:', reg.scope))
    .catch((err) => console.warn('[SW] Error al registrar:', err));
}
