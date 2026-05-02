-- ============================================
-- DepthGuard v3 — Migración: Arquitectura Multicámara
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Fecha: 2026-05-02
-- ============================================

-- 1. HISTORIAL: Agregar campos de identificación de cámara
-- Los valores por defecto permiten que datos existentes sigan funcionando
ALTER TABLE public.historial 
  ADD COLUMN IF NOT EXISTS camera_id text DEFAULT 'entrada_principal',
  ADD COLUMN IF NOT EXISTS camera_type text DEFAULT '3D',
  ADD COLUMN IF NOT EXISTS verification_level text DEFAULT '3D_antispoofing';

-- Restricción CHECK para camera_id
ALTER TABLE public.historial 
  ADD CONSTRAINT historial_camera_id_check 
  CHECK (camera_id IN ('entrada_principal', 'entrada_secundaria'));

-- Restricción CHECK para camera_type
ALTER TABLE public.historial 
  ADD CONSTRAINT historial_camera_type_check 
  CHECK (camera_type IN ('3D', '2D'));

-- Restricción CHECK para verification_level
ALTER TABLE public.historial 
  ADD CONSTRAINT historial_verification_level_check 
  CHECK (verification_level IN ('3D_antispoofing', '2D_recognition'));

-- Índice para queries filtradas por cámara (usado por getEventosPorCamara)
CREATE INDEX IF NOT EXISTS idx_historial_camera_id 
  ON public.historial(camera_id, timestamp DESC);

-- 2. USUARIOS: Agregar foto de perfil
ALTER TABLE public.usuarios 
  ADD COLUMN IF NOT EXISTS foto_perfil text;

-- 3. ESTADO_SISTEMA: Agregar columna JSONB para cámaras
-- Mantener camara_activa y modo_camara por retrocompatibilidad
ALTER TABLE public.estado_sistema 
  ADD COLUMN IF NOT EXISTS camaras jsonb DEFAULT '[
    {"camera_id": "entrada_principal", "camera_type": "3D", "activa": false, "modelo": "Intel RealSense D435"},
    {"camera_id": "entrada_secundaria", "camera_type": "2D", "activa": false, "modelo": "Webcam IP"}
  ]'::jsonb;

-- 4. Inicializar los datos existentes del historial
-- Todos los eventos previos se asignan a la cámara principal (era la única)
UPDATE public.historial 
  SET camera_id = 'entrada_principal', 
      camera_type = '3D', 
      verification_level = '3D_antispoofing'
  WHERE camera_id IS NULL OR camera_id = 'entrada_principal';

-- 5. Actualizar estado_sistema para inicializar cámaras
UPDATE public.estado_sistema 
  SET camaras = '[
    {"camera_id": "entrada_principal", "camera_type": "3D", "activa": false, "modelo": "Intel RealSense D435"},
    {"camera_id": "entrada_secundaria", "camera_type": "2D", "activa": false, "modelo": "Webcam IP"}
  ]'::jsonb
  WHERE id = 1;

-- 6. Habilitar Realtime para la tabla historial y estado_sistema de forma segura
DO $$
BEGIN
    -- Verificar y agregar 'historial' si no está en la publicación
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'historial'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.historial;
    END IF;

    -- Verificar y agregar 'estado_sistema' si no está en la publicación
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'estado_sistema'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.estado_sistema;
    END IF;
END $$;

-- ============================================
-- Verificación: Ejecutar después de la migración
-- ============================================

-- Ver estructura actualizada de historial
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'historial' ORDER BY ordinal_position;

-- Ver estructura actualizada de estado_sistema
-- SELECT * FROM public.estado_sistema WHERE id = 1;
