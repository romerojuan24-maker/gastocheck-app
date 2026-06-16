-- Push tokens para Expo Push Notifications
CREATE TABLE IF NOT EXISTS push_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL UNIQUE,
  platform    TEXT        NOT NULL,
  device_info TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used   TIMESTAMPTZ NOT NULL DEFAULT now(),
  active      BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS push_tokens_token   ON push_tokens(token);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own tokens" ON push_tokens;
CREATE POLICY "Users can manage their own tokens" ON push_tokens
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION cleanup_old_tokens()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM push_tokens WHERE last_used < NOW() - INTERVAL '30 days';
END;
$$;
