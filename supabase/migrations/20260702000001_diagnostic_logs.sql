-- Tabla de logs de diagnóstico remotos
-- Los errores de OCR, auth, y otros eventos críticos se insertan
-- automáticamente desde la app; se revisan antes de cada OTA.
CREATE TABLE IF NOT EXISTS diagnostic_logs (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  tag        text        NOT NULL,
  message    text        NOT NULL,
  level      text        NOT NULL DEFAULT 'info'
             CHECK (level IN ('info', 'warn', 'error')),
  metadata   jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE diagnostic_logs ENABLE ROW LEVEL SECURITY;

-- Cada usuario solo puede insertar sus propios logs
CREATE POLICY "diagnostic_logs_insert" ON diagnostic_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Cada usuario puede leer sus propios logs (para el export local)
CREATE POLICY "diagnostic_logs_select_own" ON diagnostic_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Índices para consultas rápidas por fecha, nivel y tag
CREATE INDEX diagnostic_logs_created_at_idx ON diagnostic_logs (created_at DESC);
CREATE INDEX diagnostic_logs_level_idx       ON diagnostic_logs (level);
CREATE INDEX diagnostic_logs_tag_idx         ON diagnostic_logs (tag);
CREATE INDEX diagnostic_logs_user_id_idx     ON diagnostic_logs (user_id);
