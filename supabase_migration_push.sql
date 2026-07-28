-- =============================================================
-- Migración: Agregar user_id + RLS a suscripciones_push
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =============================================================

-- 1. Agregar columna user_id vinculada a auth.users
--    ON DELETE CASCADE: si se elimina un admin, sus tokens se borran automáticamente
ALTER TABLE public.suscripciones_push
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Habilitar Row Level Security
ALTER TABLE public.suscripciones_push ENABLE ROW LEVEL SECURITY;

-- 3. Política: cada admin solo puede gestionar sus propias suscripciones
--    (service_role bypasea RLS por defecto, así que la Edge Function puede leer todos)
CREATE POLICY "Admins manage own push subscriptions"
  ON public.suscripciones_push
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
