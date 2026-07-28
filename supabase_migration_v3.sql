-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.usuarios (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  notas text DEFAULT ''::text,
  activo boolean DEFAULT true,
  num_angulos integer DEFAULT 0,
  embeddings_json jsonb,
  fecha_registro timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  foto_perfil text,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id)
);
CREATE TABLE public.historial (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  estado text NOT NULL CHECK (estado = ANY (ARRAY['ACCESO_PERMITIDO'::text, 'FRAUDE'::text, 'DESCONOCIDO'::text])),
  nombre text,
  usuario_id uuid,
  confianza real,
  foto_url text,
  motivo text,
  metricas_json jsonb,
  timestamp timestamp with time zone DEFAULT now(),
  camera_id text DEFAULT 'entrada_principal'::text CHECK (camera_id = ANY (ARRAY['entrada_principal'::text, 'entrada_secundaria'::text])),
  camera_type text DEFAULT '3D'::text CHECK (camera_type = ANY (ARRAY['3D'::text, '2D'::text])),
  verification_level text DEFAULT '3D_antispoofing'::text CHECK (verification_level = ANY (ARRAY['3D_antispoofing'::text, '2D_recognition'::text])),
  CONSTRAINT historial_pkey PRIMARY KEY (id),
  CONSTRAINT historial_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);
CREATE TABLE public.estado_sistema (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  camara_activa boolean DEFAULT false,
  modo_camara text DEFAULT 'simulada'::text,
  ultimo_heartbeat timestamp with time zone,
  tolerancia_facial real DEFAULT 0.55,
  umbral_varianza real DEFAULT 1.0,
  cooldown_eventos integer DEFAULT 5,
  antispoofing_activo boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now(),
  camaras jsonb DEFAULT '[{"activa": false, "modelo": "Intel RealSense D435", "camera_id": "entrada_principal", "camera_type": "3D"}, {"activa": false, "modelo": "Webcam IP", "camera_id": "entrada_secundaria", "camera_type": "2D"}]'::jsonb,
  CONSTRAINT estado_sistema_pkey PRIMARY KEY (id)
);
CREATE TABLE public.suscripciones_push (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token_fcm text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  dispositivo text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT suscripciones_push_pkey PRIMARY KEY (id)
);
CREATE TABLE public.comandos_edge (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo = ANY (ARRAY['INICIAR_REGISTRO'::text, 'CANCELAR_REGISTRO'::text])),
  usuario_id uuid,
  nombre text,
  estado text NOT NULL DEFAULT 'pendiente'::text CHECK (estado = ANY (ARRAY['pendiente'::text, 'en_progreso'::text, 'completado'::text, 'error'::text, 'cancelado'::text])),
  progreso integer DEFAULT 0,
  resultado jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT comandos_edge_pkey PRIMARY KEY (id),
  CONSTRAINT comandos_edge_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id)
);