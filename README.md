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

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | API key pública (anon) de Supabase |

## Pantallas

| Ruta | Pantalla | Descripción |
|------|----------|-------------|
| `/` | Login | Autenticación de admin |
| `/dashboard` | Inicio | Contadores + estado del sistema + últimos eventos |
| `/live` | Monitor en Vivo | **Split-Screen** con 2 paneles de cámara (3D + 2D) |
| `/history` | Historial | Eventos filtrables por tipo y búsqueda |
| `/users` | Usuarios | CRUD de usuarios biométricos |
| `/settings` | Ajustes | Estado del nodo edge, cámaras y configuración |

## Proyecto de Grado 2026

**DepthGuard** — Sistema de control de acceso biométrico con reconocimiento facial 3D y detección anti-spoofing.

Institución Universitaria de Colombia.
