-- Push tokens table para Expo Push Notifications
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL, -- 'ios' | 'android'
  device_info TEXT,
  created_at TIMESTAMP DEFAULT now(),
  last_used TIMESTAMP DEFAULT now(),
  active BOOLEAN DEFAULT TRUE
);

CREATE INDEX push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX push_tokens_token ON push_tokens(token);

-- RLS: cada usuario solo puede ver sus propios tokens
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own tokens" ON push_tokens
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Función para limpiar tokens viejos (cada 30 días sin usar)
CREATE OR REPLACE FUNCTION cleanup_old_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM push_tokens
  WHERE last_used < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
