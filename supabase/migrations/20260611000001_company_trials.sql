-- ============================================================================
-- GastoCheck — Trial tracking
-- ============================================================================

-- Columna de prueba en companies (NULL = sin trial / plan pagado)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_device_id text;

-- Tabla de dispositivos de prueba — previene abuso de trial por dispositivo
CREATE TABLE IF NOT EXISTS trial_devices (
  device_id      text PRIMARY KEY,
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  registered_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trial_devices ENABLE ROW LEVEL SECURITY;

-- Solo accesible via service role (edge functions); nunca desde el cliente
CREATE POLICY "no client access trial_devices"
  ON trial_devices
  USING (false);

-- Helper: ¿la empresa está en prueba activa?
CREATE OR REPLACE FUNCTION company_is_in_trial(p_company uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT coalesce(
    (SELECT trial_ends_at > now() FROM companies WHERE id = p_company),
    false
  );
$$;

-- Helper: ¿la empresa puede agregar más miembros? (trial max 2)
CREATE OR REPLACE FUNCTION company_can_add_member(p_company uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT CASE
    WHEN NOT company_is_in_trial(p_company) THEN true
    ELSE (
      SELECT (SELECT count(*) FROM company_members m WHERE m.company_id = p_company)
           < (SELECT c.plan_seats FROM companies c WHERE c.id = p_company)
    )
  END;
$$;

-- Bloquear invitaciones cuando se supera el límite del plan/trial
CREATE OR REPLACE FUNCTION check_member_limit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT company_can_add_member(NEW.company_id) THEN
    RAISE EXCEPTION 'Límite de miembros alcanzado. Actualiza tu plan para agregar más usuarios.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_member_limit
  BEFORE INSERT ON company_members
  FOR EACH ROW
  EXECUTE FUNCTION check_member_limit();
