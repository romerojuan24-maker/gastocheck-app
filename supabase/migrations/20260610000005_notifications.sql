-- Tabla de notificaciones para push + in-app
CREATE TABLE IF NOT EXISTS notifications (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id        uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recipient_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type              text        NOT NULL, -- 'receipt_submitted', 'advance_approved', 'batch_closed', etc.
  title             text        NOT NULL,
  message           text,
  data              jsonb,
  read_at           timestamptz,
  action_url        text,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications(recipient_id, read_at DESC);
CREATE INDEX IF NOT EXISTS notifications_company_type_idx ON notifications(company_id, type);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Usuario ve sus propias notificaciones
CREATE POLICY "notif_own" ON notifications
  FOR ALL USING (recipient_id = auth.uid());
