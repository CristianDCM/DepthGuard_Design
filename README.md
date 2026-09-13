#  DepthGuard Admin — Panel de Control

> Frontend del sistema de control de acceso biométrico 3D con detección anti-spoofing.

## Stack

- **React 19** + **TypeScript** + **Vite**
- **Supabase** (PostgreSQL + jsonb + Realtime)
- **TailwindCSS v4** + **Motion** (Framer Motion)
- **Lucide React** (iconos)
- Deployado en **Vercel** (HTTPS automático, CDN global)

## Arquitectura

```
Nodo Edge (PC Central)         Cloud (Supabase)         Frontend (Vercel)
┌────────────────┐        ┌──────────────────┐      ┌──────────────────┐
│ RealSense 3D   │──JSON──│ PostgreSQL       │──RT──│ React Dashboard  │
│ Webcam 2D      │        │ jsonb            │      │ Split-Screen     │
│ Python Service │──FCM──│ Realtime         │      │ 5 tabs + modales │
└────────────────┘        └──────────────────┘      └──────────────────┘
```

- **No se envía video por red** — solo embeddings + metadatos JSON
- **Supabase Realtime** reemplaza WebSockets propios
- **Split-Screen** para monitorear 2 cámaras simultáneamente

## Ejecutar localmente

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus credenciales de Supabase

# 3. Iniciar servidor de desarrollo
npm run dev
```

## Verificación

```bash
npm run lint          # Comprobación de tipos (TypeScript)
npm run test          # Pruebas unitarias en modo watch
npm run test:run      # Una pasada — es lo que ejecuta el CI
npm run test:coverage # Informe de cobertura
npm run build         # Build de producción
```

El workflow `CI` ejecuta typecheck, pruebas y build en cada push y pull
request a `main`.

## Despliegue

Son dos destinos distintos y conviene no confundirlos:

| Qué | Dónde | Cómo |
|---|---|---|
| Frontend (React, Service Worker, cabeceras de `vercel.json`) | Vercel | Automático en cada merge a `main` |
| Edge Functions (`supabase/functions/`) | Supabase | Workflow `Desplegar Edge Functions` |

**`git push` no despliega las Edge Functions.** Vercel sí se actualiza solo,
y eso da la falsa impresión de que todo el proyecto está desplegado. El
workflow `deploy-functions.yml` cierra ese hueco: se dispara al cambiar
`supabase/functions/**` o `supabase/config.toml`, y despliega únicamente las
funciones modificadas.

Requiere el secreto `SUPABASE_ACCESS_TOKEN` (se genera en
https://supabase.com/dashboard/account/tokens). Para desplegarlas todas a
mano —por ejemplo, para recuperar producción tras un cambio hecho fuera del
repositorio— se ejecuta el workflow desde la pestaña Actions.

`supabase/config.toml` declara el `verify_jwt` de cada función. No es
opcional: sin él la CLI aplicaría `verify_jwt = true` por defecto y
`notify-event` dejaría de funcionar, porque es un webhook que invoca la
propia base de datos sin ningún JWT.

### Pruebas

46 pruebas sobre la lógica verificable de forma determinista:

| Módulo | Qué cubre |
|---|---|
| `sanitize` | Escapado de HTML en los informes y protección contra inyección de fórmulas en CSV |
| `loginLockout` | Bloqueo progresivo tras intentos fallidos, incluida su monotonía |
| `heartbeat` | Detección de nodo edge offline y estado real de las cámaras |
| `exportUtils` | Generación del CSV del historial |
| `pushNotifications` | Detección de soporte de notificaciones del navegador |

Las rutas de entrada/salida contra Firebase y Supabase no se simulan: se
verifican contra los servicios reales.

## Seguridad

- Autenticación validada siempre contra Supabase Auth, nunca contra `localStorage`
- Cierre de sesión automático por inactividad (15 min) con aviso previo
- Bloqueo progresivo del login tras intentos fallidos
- Cabeceras HTTP: CSP, `X-Frame-Options: DENY`, HSTS, `Referrer-Policy`, `Permissions-Policy`
- El panel no se indexa en buscadores (`noindex` + `robots.txt`)
- Escapado del contenido de origen no confiable (`nombre`, `motivo`) en los informes generados

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | API key pública (anon) de Supabase |

La configuración de Firebase Cloud Messaging no se toma de variables de
entorno: el Service Worker no puede leer `import.meta.env`, así que vive en
`src/lib/firebase.ts` y `public/firebase-messaging-sw.js`. Las credenciales
que sí son secretas son secrets de la Edge Function `notify-event`. Ver
`.env.example`.

## Pantallas

| Ruta | Pantalla | Descripción |
|------|----------|-------------|
| `/` | Login | Autenticación de admin |
| `*` | 404 | Cualquier ruta no reconocida |
| `/dashboard` | Inicio | Contadores + estado del sistema + últimos eventos |
| `/live` | Monitor en Vivo | **Split-Screen** con 2 paneles de cámara (3D + 2D) |
| `/history` | Historial | Eventos filtrables por tipo y búsqueda |
| `/users` | Usuarios | CRUD de usuarios biométricos |
| `/settings` | Ajustes | Estado del nodo edge, cámaras y configuración |

## Proyecto de Grado 2026

**DepthGuard** — Sistema de control de acceso biométrico con reconocimiento facial 3D y detección anti-spoofing.

Institución Universitaria de Colombia.
