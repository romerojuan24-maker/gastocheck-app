-- Solicitudes de anticipo — empleados piden, supervisores aprueban
CREATE TABLE IF NOT EXISTS advance_requests (
  id                uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id        uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requester_id      uuid        NOT NULL REFERENCES auth.users(id),
  amount            numeric(12,2) NOT NULL CHECK (amount > 0),
  reason            text        NOT NULL,
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','approved','rejected','cancelled')),
  reviewer_id       uuid        REFERENCES auth.users(id),
  reviewed_at       timestamptz,
  rejection_reason  text,
  linked_advance_id uuid        REFERENCES advances(id) ON DELETE SET NULL,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS advance_requests_company_idx   ON advance_requests(company_id);
CREATE INDEX IF NOT EXISTS advance_requests_requester_idx ON advance_requests(requester_id);
CREATE INDEX IF NOT EXISTS advance_requests_status_idx    ON advance_requests(status);

ALTER TABLE advance_requests ENABLE ROW LEVEL SECURITY;

-- Empleado ve y gestiona sus propias solicitudes
CREATE POLICY "adv_req_own" ON advance_requests
  FOR ALL USING (requester_id = auth.uid());

-- Admin/supervisor ve todas las solicitudes de su empresa
CREATE POLICY "adv_req_supervisor" ON advance_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_members.company_id = advance_requests.company_id
        AND company_members.user_id    = auth.uid()
        AND company_members.role       IN ('admin','supervisor')
    )
  );
