-- ============================================================================
-- GastoCheck — Events, gastadores por evento y folios automáticos
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Columnas de trial en companies (idempotente; ya existen en 20260611000001
--    si ese script se ejecutó, ADD COLUMN IF NOT EXISTS lo tolera sin error)
-- ----------------------------------------------------------------------------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS trial_ends_at   timestamptz,
  ADD COLUMN IF NOT EXISTS trial_device_id text;

-- ----------------------------------------------------------------------------
-- 2. trial_devices (idempotente)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS trial_devices (
  device_id     text        PRIMARY KEY,
  company_id    uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trial_devices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trial_devices'
      AND policyname = 'no client access trial_devices'
  ) THEN
    CREATE POLICY "no client access trial_devices"
      ON trial_devices
      USING (false);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. events
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text          NOT NULL,
  description  text,
  start_date   date,
  end_date     date,
  budget       numeric(14,2) NOT NULL DEFAULT 0 CHECK (budget >= 0),
  gastador_id  uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  status       text          NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','closed','cancelled')),
  created_by   uuid          NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_company_idx    ON events(company_id);
CREATE INDEX IF NOT EXISTS events_gastador_idx   ON events(gastador_id);
CREATE INDEX IF NOT EXISTS events_status_idx     ON events(company_id, status);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'events' AND policyname = 'members read events'
  ) THEN
    CREATE POLICY "members read events"
      ON events FOR SELECT
      USING (auth_is_member(company_id));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'events' AND policyname = 'owner admin manage events'
  ) THEN
    CREATE POLICY "owner admin manage events"
      ON events FOR ALL
      USING  (auth_role(company_id) IN ('owner','admin'))
      WITH CHECK (auth_role(company_id) IN ('owner','admin'));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 4. event_expenses
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_expenses (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid          NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_id        uuid          NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  spender_id      uuid          NOT NULL REFERENCES auth.users(id),
  folio           text,
  type            text          NOT NULL DEFAULT 'expense'
                                CHECK (type IN ('advance','expense')),
  description     text          NOT NULL,
  amount          numeric(14,2) NOT NULL CHECK (amount > 0),
  method          text          NOT NULL DEFAULT 'transfer'
                                CHECK (method IN ('transfer','cash','card','other')),
  comprobante_url text,
  expense_date    date          NOT NULL DEFAULT CURRENT_DATE,
  created_by      uuid          NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_expenses_company_idx  ON event_expenses(company_id);
CREATE INDEX IF NOT EXISTS event_expenses_event_idx    ON event_expenses(event_id);
CREATE INDEX IF NOT EXISTS event_expenses_spender_idx  ON event_expenses(spender_id);
CREATE INDEX IF NOT EXISTS event_expenses_date_idx     ON event_expenses(expense_date);

ALTER TABLE event_expenses ENABLE ROW LEVEL SECURITY;

-- Members: owner/admin see all; others see only their own rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_expenses' AND policyname = 'event_expenses read own or admin'
  ) THEN
    CREATE POLICY "event_expenses read own or admin"
      ON event_expenses FOR SELECT
      USING (
        auth_is_member(company_id)
        AND (
          auth_role(company_id) IN ('owner','admin')
          OR spender_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Owner/admin/supervisor manage all rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_expenses' AND policyname = 'event_expenses owner admin supervisor manage'
  ) THEN
    CREATE POLICY "event_expenses owner admin supervisor manage"
      ON event_expenses FOR ALL
      USING  (auth_role(company_id) IN ('owner','admin','supervisor'))
      WITH CHECK (auth_role(company_id) IN ('owner','admin','supervisor'));
  END IF;
END $$;

-- Spender can insert their own expenses
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'event_expenses' AND policyname = 'event_expenses spender insert own'
  ) THEN
    CREATE POLICY "event_expenses spender insert own"
      ON event_expenses FOR INSERT
      WITH CHECK (
        auth_is_member(company_id)
        AND spender_id = auth.uid()
        AND created_by = auth.uid()
      );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. generate_event_folio(p_spender_id, p_date, p_company_id) RETURNS text
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION generate_event_folio(
  p_spender_id uuid,
  p_date       date,
  p_company_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_full_name text;
  v_initials  text := 'XX';
  v_word      text;
  v_words     text[];
  v_datepart  text;
  v_seq       int;
  v_letter    text;
  v_buf       text := '';
  v_count     int  := 0;
BEGIN
  -- Get full_name from profiles
  SELECT full_name
    INTO v_full_name
    FROM profiles
   WHERE id = p_spender_id;

  -- Build initials: first letter of each word, max 3, uppercase
  IF v_full_name IS NOT NULL AND trim(v_full_name) <> '' THEN
    v_words := string_to_array(trim(regexp_replace(v_full_name, '\s+', ' ', 'g')), ' ');
    FOREACH v_word IN ARRAY v_words LOOP
      EXIT WHEN v_count >= 3;
      v_letter := upper(left(v_word, 1));
      -- Only include alphabetic characters
      IF v_letter ~ '^[A-ZÁÉÍÓÚÑÜ]$' THEN
        v_buf   := v_buf || v_letter;
        v_count := v_count + 1;
      END IF;
    END LOOP;
    IF v_count > 0 THEN
      v_initials := v_buf;
    END IF;
  END IF;

  -- Format date as YYMMDD
  v_datepart := to_char(p_date, 'YYMMDD');

  -- Count existing rows for same spender + company + date, then add 1
  SELECT count(*) + 1
    INTO v_seq
    FROM event_expenses
   WHERE spender_id  = p_spender_id
     AND company_id  = p_company_id
     AND expense_date = p_date;

  RETURN v_initials || '-' || v_datepart || '-' || lpad(v_seq::text, 2, '0');
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. Trigger function that assigns folio when null
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_fn_event_folio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.folio IS NULL THEN
    NEW.folio := generate_event_folio(NEW.spender_id, NEW.expense_date, NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. Trigger on event_expenses BEFORE INSERT
-- ----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_event_expense_folio ON event_expenses;

CREATE TRIGGER trg_event_expense_folio
  BEFORE INSERT ON event_expenses
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_event_folio();

-- ----------------------------------------------------------------------------
-- 8. RLS policy for companies INSERT (idempotente)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename  = 'companies'
      AND policyname = 'create company'
  ) THEN
    CREATE POLICY "create company"
      ON companies FOR INSERT
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 9. Storage bucket for event comprobantes
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-comprobantes', 'event-comprobantes', true)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 10. Storage RLS: authenticated users can upload to event-comprobantes
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename  = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'authenticated upload event comprobantes'
  ) THEN
    CREATE POLICY "authenticated upload event comprobantes"
      ON storage.objects FOR INSERT
      WITH CHECK (
        bucket_id = 'event-comprobantes'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename  = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'authenticated read event comprobantes'
  ) THEN
    CREATE POLICY "authenticated read event comprobantes"
      ON storage.objects FOR SELECT
      USING (
        bucket_id = 'event-comprobantes'
        AND auth.role() = 'authenticated'
      );
  END IF;
END $$;
