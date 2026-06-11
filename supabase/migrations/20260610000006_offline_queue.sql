-- Cola de sincronización para modo offline
CREATE TABLE IF NOT EXISTS sync_queue (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id        uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type       text        NOT NULL, -- 'receipt', 'expense', 'advance_request', etc.
  operation         text        NOT NULL, -- 'create', 'update', 'delete'
  payload           jsonb       NOT NULL,
  status            text        DEFAULT 'pending' CHECK (status IN ('pending','syncing','synced','failed')),
  error_message     text,
  synced_at         timestamptz,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sync_queue_user_status_idx ON sync_queue(user_id, status);
CREATE INDEX IF NOT EXISTS sync_queue_created_idx ON sync_queue(created_at DESC);

ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

-- Usuario ve su propia cola
CREATE POLICY "sq_own" ON sync_queue
  FOR ALL USING (user_id = auth.uid());
