-- ============================================================================
-- GastoCheck — Migration 0003: Comprobantes, Duplicados, Proveedores,
--              Relaciones, Categorías por sector, Exportación contable
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================================================

-- ============================================================================
-- 1. NUEVOS VALORES DE ENUM
-- ============================================================================
-- Roles adicionales (operator = alias amigable de spender; admin > office; superadmin = plataforma)
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'operator'   AFTER 'spender';
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'admin'      AFTER 'office';
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'superadmin' AFTER 'admin';

-- ============================================================================
-- 2. COLUMNAS NUEVAS EN TABLAS EXISTENTES
-- ============================================================================

-- Sector de la empresa (determina plantillas de categorías precargadas)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS sector text
    CHECK (sector IN ('agro','construccion','alimentos','transportistas',
                      'distribucion','servicios_tecnicos','manufactura','comercio','otro'));

-- Columnas adicionales en expense_categories
ALTER TABLE expense_categories
  ADD COLUMN IF NOT EXISTS is_custom    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_template  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sector       text,
  ADD COLUMN IF NOT EXISTS acct_code    text,   -- código de cuenta contable
  ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 0;

-- receipt_id en expenses (enlace al comprobante fuente, nullable para datos legacy)
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS receipt_id uuid;     -- FK se agrega al final cuando existe receipts

-- ============================================================================
-- 3. TABLA: suppliers (proveedores normalizados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS suppliers (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  name                 text NOT NULL,
  normalized_name      text NOT NULL,
  rfc                  text,
  phone                text,
  email                text,
  address              text,

  -- Grupo de normalización: permite agrupar variantes (OXXO, OXXO Gas, Cadena OXXO...)
  canonical_supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,

  first_purchase_date  date,
  last_purchase_date   date,
  total_purchases      numeric(14,2) NOT NULL DEFAULT 0,
  purchase_count       int NOT NULL DEFAULT 0,

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_company     ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_normalized  ON suppliers(company_id, normalized_name);
CREATE INDEX IF NOT EXISTS idx_suppliers_rfc         ON suppliers(company_id, rfc);

-- ============================================================================
-- 4. TABLA: receipt_batches (relaciones/cierres contables)
-- ============================================================================
CREATE TABLE IF NOT EXISTS receipt_batches (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  name           text NOT NULL,
  period_start   date NOT NULL,
  period_end     date NOT NULL,

  status         text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','closed','exported','reopened','cancelled')),

  notes          text,
  reopen_reason  text,

  created_by     uuid NOT NULL REFERENCES auth.users(id),
  closed_by      uuid REFERENCES auth.users(id),
  exported_by    uuid REFERENCES auth.users(id),
  reopened_by    uuid REFERENCES auth.users(id),

  total_amount   numeric(14,2),
  receipt_count  int,

  created_at     timestamptz NOT NULL DEFAULT now(),
  closed_at      timestamptz,
  exported_at    timestamptz,
  reopened_at    timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_receipt_batches_company ON receipt_batches(company_id, status);

-- ============================================================================
-- 5. TABLA: receipts (comprobante como entidad independiente — centro del sistema)
-- ============================================================================
CREATE TABLE IF NOT EXISTS receipts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  uploaded_by           uuid NOT NULL REFERENCES auth.users(id),
  employee_id           uuid REFERENCES auth.users(id),  -- puede diferir del uploader

  -- Origen del comprobante
  source_type           text NOT NULL DEFAULT 'photo'
    CHECK (source_type IN ('photo','pdf','xml','manual')),

  -- Datos del proveedor
  provider_name         text,
  normalized_provider_name text,
  provider_rfc          text,
  supplier_id           uuid REFERENCES suppliers(id) ON DELETE SET NULL,

  -- Fecha y hora del comprobante (no de captura)
  receipt_date          date,
  receipt_time          time,

  -- Montos
  total_amount          numeric(14,2),
  subtotal_amount       numeric(14,2),
  tax_amount            numeric(14,2),
  currency              text NOT NULL DEFAULT 'MXN',

  -- Datos fiscales
  fiscal_uuid           text,   -- UUID del CFDI timbrado
  internal_folio        text,
  payment_method        text,

  -- OCR / extracción IA
  ocr_text              text,
  ocr_confidence        numeric(5,2),   -- 0-100
  extracted_json        jsonb,          -- resultado completo del OCR

  -- Archivos
  file_url              text,
  file_storage_path     text,
  file_sha256           text,           -- hash exacto para deduplicación
  image_phash           text,           -- hash perceptual de imagen

  -- Anti-duplicados
  duplicate_status      text NOT NULL DEFAULT 'no_duplicate'
    CHECK (duplicate_status IN (
      'no_duplicate','possible_duplicate','strong_duplicate',
      'blocked_duplicate','manually_approved_duplicate'
    )),
  duplicate_score       numeric(5,2),
  duplicate_of_receipt_id uuid REFERENCES receipts(id) ON DELETE SET NULL,
  duplicate_reason      text,

  -- Estado del comprobante
  status                text NOT NULL DEFAULT 'captured'
    CHECK (status IN (
      'captured','submitted','approved','rejected',
      'included_in_batch','exported','cancelled'
    )),

  -- Categorización
  category_id           uuid REFERENCES expense_categories(id) ON DELETE SET NULL,
  cost_center_id        uuid REFERENCES cost_centers(id) ON DELETE SET NULL,
  notes                 text,
  rejection_reason      text,

  -- Lote/relación al que pertenece
  batch_id              uuid REFERENCES receipt_batches(id) ON DELETE SET NULL,

  -- Auditores
  approved_by           uuid REFERENCES auth.users(id),
  approved_at           timestamptz,
  rejected_by           uuid REFERENCES auth.users(id),
  rejected_at           timestamptz,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Índices de receipts
CREATE INDEX IF NOT EXISTS idx_receipts_company         ON receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_receipts_employee        ON receipts(company_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status          ON receipts(company_id, status);
CREATE INDEX IF NOT EXISTS idx_receipts_duplicate       ON receipts(company_id, duplicate_status);
CREATE INDEX IF NOT EXISTS idx_receipts_date            ON receipts(company_id, receipt_date);
CREATE INDEX IF NOT EXISTS idx_receipts_total           ON receipts(company_id, total_amount);
CREATE INDEX IF NOT EXISTS idx_receipts_provider        ON receipts(company_id, normalized_provider_name);
CREATE INDEX IF NOT EXISTS idx_receipts_sha256          ON receipts(company_id, file_sha256) WHERE file_sha256 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_receipts_batch           ON receipts(batch_id) WHERE batch_id IS NOT NULL;

-- UUID fiscal ÚNICO por empresa (previene CFDI duplicado entre pólizas/periodos)
CREATE UNIQUE INDEX IF NOT EXISTS receipts_fiscal_uuid_company_unique
  ON receipts(company_id, fiscal_uuid)
  WHERE fiscal_uuid IS NOT NULL;

-- ============================================================================
-- 6. FK de expenses → receipts (después de crear receipts)
-- ============================================================================
ALTER TABLE expenses
  ADD CONSTRAINT expenses_receipt_id_fk
    FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_receipt ON expenses(receipt_id) WHERE receipt_id IS NOT NULL;

-- ============================================================================
-- 7. TABLA: receipt_duplicate_matches (registro de coincidencias)
-- ============================================================================
CREATE TABLE IF NOT EXISTS receipt_duplicate_matches (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  receipt_id          uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  matched_receipt_id  uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,

  match_type          text NOT NULL
    CHECK (match_type IN (
      'fiscal_uuid','file_hash','image_phash',
      'provider_date_amount','rfc_date_amount','ocr_similarity'
    )),
  match_score         numeric(5,2),
  match_reason        text,

  resolved            boolean NOT NULL DEFAULT false,
  resolved_by         uuid REFERENCES auth.users(id),
  resolution          text
    CHECK (resolution IN ('confirmed_duplicate','false_positive','manually_allowed')),
  resolution_reason   text,

  created_at          timestamptz NOT NULL DEFAULT now(),
  resolved_at         timestamptz
);
CREATE INDEX IF NOT EXISTS idx_dup_matches_receipt ON receipt_duplicate_matches(receipt_id);
CREATE INDEX IF NOT EXISTS idx_dup_matches_company ON receipt_duplicate_matches(company_id, resolved);

-- ============================================================================
-- 8. TABLA: purchase_items (conceptos/productos comprados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS purchase_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  receipt_id            uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,

  item_name             text NOT NULL,
  normalized_item_name  text,
  quantity              numeric(14,4),
  unit                  text,
  unit_price            numeric(14,4),
  total_price           numeric(14,2),

  extracted_by          text NOT NULL DEFAULT 'manual'
    CHECK (extracted_by IN ('manual','ocr','xml')),
  confidence            numeric(5,2),

  created_at            timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_receipt  ON purchase_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_company  ON purchase_items(company_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_name     ON purchase_items(company_id, normalized_item_name);

-- ============================================================================
-- 9. TABLA: receipt_batch_items (relación receipt ↔ batch)
-- ============================================================================
CREATE TABLE IF NOT EXISTS receipt_batch_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  batch_id    uuid NOT NULL REFERENCES receipt_batches(id) ON DELETE CASCADE,
  receipt_id  uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  added_by    uuid NOT NULL REFERENCES auth.users(id),
  added_at    timestamptz NOT NULL DEFAULT now()
);

-- Un comprobante solo puede estar en UNA relación por empresa
CREATE UNIQUE INDEX IF NOT EXISTS unique_receipt_in_one_batch
  ON receipt_batch_items(company_id, receipt_id);

-- ============================================================================
-- 10. TABLA: expense_tags (etiquetas/dimensiones operativas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS expense_tags (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        text NOT NULL,
  tag_type    text
    CHECK (tag_type IN ('obra','rancho','lote','cultivo','unidad','ruta',
                        'tecnico','cliente','proyecto','temporada','maquinaria','otro')),
  color       text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expense_tags_company ON expense_tags(company_id, is_active);

-- Etiquetas aplicadas a comprobantes
CREATE TABLE IF NOT EXISTS receipt_tags (
  receipt_id  uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  tag_id      uuid NOT NULL REFERENCES expense_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (receipt_id, tag_id)
);

-- ============================================================================
-- 11. TABLA: expense_category_templates (plantillas por sector)
-- ============================================================================
CREATE TABLE IF NOT EXISTS expense_category_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector        text NOT NULL,   -- 'universal' o uno de los sectores
  name          text NOT NULL,
  parent_name   text,
  description   text,
  is_default    boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cat_templates_sector ON expense_category_templates(sector);

-- ============================================================================
-- 12. TABLA: expense_category_rules (reglas de campos requeridos por categoría)
-- ============================================================================
CREATE TABLE IF NOT EXISTS expense_category_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id  uuid NOT NULL REFERENCES expense_categories(id) ON DELETE CASCADE,
  required_field text NOT NULL,   -- 'unit', 'cost_center', 'tag_cultivo', etc.
  rule_type    text NOT NULL DEFAULT 'required'
    CHECK (rule_type IN ('required','recommended','hidden')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cat_rules_company  ON expense_category_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_cat_rules_category ON expense_category_rules(category_id);

-- ============================================================================
-- 13. TABLA: accounting_export_profiles (perfiles de exportación contable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounting_export_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         text NOT NULL,
  system_type  text NOT NULL
    CHECK (system_type IN ('universal_excel','contpaqi','aspel_coi','microsip','custom')),
  config_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_default   boolean NOT NULL DEFAULT false,
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acct_profiles_company ON accounting_export_profiles(company_id);

-- ============================================================================
-- 14. TABLA: accounting_category_map (mapeo categoría → cuenta contable)
-- ============================================================================
CREATE TABLE IF NOT EXISTS accounting_category_map (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  expense_category_id  uuid REFERENCES expense_categories(id) ON DELETE SET NULL,
  cost_center_id       uuid REFERENCES cost_centers(id) ON DELETE SET NULL,
  accounting_account   text NOT NULL,   -- cuenta de gasto
  tax_account          text,            -- cuenta de IVA
  counterpart_account  text,            -- cuenta de caja/bancos/deudores
  department_code      text,
  segment_code         text,
  export_profile_id    uuid REFERENCES accounting_export_profiles(id) ON DELETE CASCADE,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acct_map_company  ON accounting_category_map(company_id);
CREATE INDEX IF NOT EXISTS idx_acct_map_category ON accounting_category_map(expense_category_id);

-- ============================================================================
-- 15. TABLA: audit_logs (bitácora general de eventos críticos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id      uuid REFERENCES auth.users(id),
  entity_type  text NOT NULL,   -- 'receipt', 'batch', 'expense', 'category', 'profile', etc.
  entity_id    uuid NOT NULL,
  action       text NOT NULL,
  old_values   jsonb,
  new_values   jsonb,
  reason       text,
  ip_address   text,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity  ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user    ON audit_logs(user_id, created_at DESC);

-- ============================================================================
-- 16. TRIGGERS updated_at para tablas nuevas
-- ============================================================================
CREATE TRIGGER trg_suppliers_touch
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_receipt_batches_touch
  BEFORE UPDATE ON receipt_batches
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_receipts_touch
  BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_acct_profiles_touch
  BEFORE UPDATE ON accounting_export_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================================
-- 17. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE suppliers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_batches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_duplicate_matches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_batch_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_tags               ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_tags               ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_category_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_category_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_export_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_category_map    ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs                 ENABLE ROW LEVEL SECURITY;

-- ── suppliers ────────────────────────────────────────────────
CREATE POLICY "members read suppliers"
  ON suppliers FOR SELECT USING (auth_is_member(company_id));

CREATE POLICY "admin manage suppliers"
  ON suppliers FOR ALL
  USING  (auth_role(company_id) IN ('owner','supervisor','admin','office','superadmin'))
  WITH CHECK (auth_role(company_id) IN ('owner','supervisor','admin','office','superadmin'));

-- ── receipt_batches ──────────────────────────────────────────
CREATE POLICY "members read batches"
  ON receipt_batches FOR SELECT USING (auth_is_member(company_id));

CREATE POLICY "admin manage batches"
  ON receipt_batches FOR ALL
  USING  (auth_role(company_id) IN ('owner','supervisor','admin','superadmin'))
  WITH CHECK (auth_role(company_id) IN ('owner','supervisor','admin','superadmin'));

-- ── receipts ─────────────────────────────────────────────────
-- Operador/spender ve sus propios comprobantes; el resto ve todos los de la empresa
CREATE POLICY "read receipts"
  ON receipts FOR SELECT
  USING (
    auth_is_member(company_id)
    AND (
      auth_can_view_all(company_id)
      OR employee_id = auth.uid()
      OR uploaded_by = auth.uid()
    )
  );

CREATE POLICY "insert own receipt"
  ON receipts FOR INSERT
  WITH CHECK (auth_is_member(company_id) AND uploaded_by = auth.uid());

CREATE POLICY "update own draft receipt"
  ON receipts FOR UPDATE
  USING (
    uploaded_by = auth.uid()
    AND status IN ('captured','submitted')
  );

CREATE POLICY "admin update receipt"
  ON receipts FOR UPDATE
  USING (auth_role(company_id) IN ('owner','supervisor','admin','office','superadmin'));

-- ── receipt_duplicate_matches ─────────────────────────────────
CREATE POLICY "read duplicate matches"
  ON receipt_duplicate_matches FOR SELECT USING (auth_is_member(company_id));

CREATE POLICY "insert duplicate match"
  ON receipt_duplicate_matches FOR INSERT WITH CHECK (auth_is_member(company_id));

CREATE POLICY "admin resolve duplicate"
  ON receipt_duplicate_matches FOR UPDATE
  USING (auth_role(company_id) IN ('owner','supervisor','admin','superadmin'));

-- ── purchase_items ────────────────────────────────────────────
CREATE POLICY "read purchase items"
  ON purchase_items FOR SELECT
  USING (
    auth_is_member(company_id)
    AND (
      auth_can_view_all(company_id)
      OR EXISTS (
        SELECT 1 FROM receipts r
        WHERE r.id = receipt_id
          AND (r.employee_id = auth.uid() OR r.uploaded_by = auth.uid())
      )
    )
  );

CREATE POLICY "write purchase items"
  ON purchase_items FOR ALL
  USING (auth_is_member(company_id))
  WITH CHECK (auth_is_member(company_id));

-- ── receipt_batch_items ───────────────────────────────────────
CREATE POLICY "read batch items"
  ON receipt_batch_items FOR SELECT USING (auth_is_member(company_id));

CREATE POLICY "admin manage batch items"
  ON receipt_batch_items FOR ALL
  USING  (auth_role(company_id) IN ('owner','supervisor','admin','accountant','superadmin'))
  WITH CHECK (auth_role(company_id) IN ('owner','supervisor','admin','accountant','superadmin'));

-- ── expense_tags ──────────────────────────────────────────────
CREATE POLICY "read tags"
  ON expense_tags FOR SELECT USING (auth_is_member(company_id));

CREATE POLICY "admin manage tags"
  ON expense_tags FOR ALL
  USING  (auth_role(company_id) IN ('owner','supervisor','admin','superadmin'))
  WITH CHECK (auth_role(company_id) IN ('owner','supervisor','admin','superadmin'));

-- ── receipt_tags ──────────────────────────────────────────────
CREATE POLICY "read receipt tags"
  ON receipt_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM receipts r WHERE r.id = receipt_id AND auth_is_member(r.company_id)
    )
  );

CREATE POLICY "write receipt tags"
  ON receipt_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM receipts r WHERE r.id = receipt_id AND auth_is_member(r.company_id)
    )
  );

-- ── expense_category_templates ────────────────────────────────
-- Templates son públicos (sin RLS selectivo; solo lectura)
CREATE POLICY "everyone reads templates"
  ON expense_category_templates FOR SELECT USING (true);

-- ── expense_category_rules ─────────────────────────────────────
CREATE POLICY "members read category rules"
  ON expense_category_rules FOR SELECT USING (auth_is_member(company_id));

CREATE POLICY "admin manage category rules"
  ON expense_category_rules FOR ALL
  USING  (auth_role(company_id) IN ('owner','admin','superadmin'))
  WITH CHECK (auth_role(company_id) IN ('owner','admin','superadmin'));

-- ── accounting_export_profiles ─────────────────────────────────
CREATE POLICY "members read export profiles"
  ON accounting_export_profiles FOR SELECT USING (auth_is_member(company_id));

CREATE POLICY "admin manage export profiles"
  ON accounting_export_profiles FOR ALL
  USING  (auth_role(company_id) IN ('owner','accountant','admin','superadmin'))
  WITH CHECK (auth_role(company_id) IN ('owner','accountant','admin','superadmin'));

-- ── accounting_category_map ────────────────────────────────────
CREATE POLICY "members read category map"
  ON accounting_category_map FOR SELECT USING (auth_is_member(company_id));

CREATE POLICY "admin manage category map"
  ON accounting_category_map FOR ALL
  USING  (auth_role(company_id) IN ('owner','accountant','admin','superadmin'))
  WITH CHECK (auth_role(company_id) IN ('owner','accountant','admin','superadmin'));

-- ── audit_logs ─────────────────────────────────────────────────
CREATE POLICY "admin read audit logs"
  ON audit_logs FOR SELECT
  USING (auth_role(company_id) IN ('owner','admin','accountant','superadmin'));

CREATE POLICY "insert audit log"
  ON audit_logs FOR INSERT WITH CHECK (auth_is_member(company_id));

-- ============================================================================
-- 18. ACTUALIZACIÓN DE HELPERS DE AUTORIZACIÓN
-- ============================================================================

-- Incluye los nuevos roles admin y superadmin
CREATE OR REPLACE FUNCTION auth_can_view_all(p_company uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT auth_role(p_company) IN (
    'owner','supervisor','office','accountant','admin','superadmin'
  );
$$;

CREATE OR REPLACE FUNCTION auth_can_authorize(p_company uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT auth_role(p_company) IN ('owner','supervisor','admin','superadmin');
$$;

-- Nuevo helper: ¿es administrador?
CREATE OR REPLACE FUNCTION auth_is_admin(p_company uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT auth_role(p_company) IN ('owner','admin','superadmin');
$$;

-- ============================================================================
-- 19. FUNCIÓN helper para normalizar nombres de proveedores
-- ============================================================================
CREATE OR REPLACE FUNCTION normalize_provider_name(p_name text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT upper(
    regexp_replace(
      translate(
        p_name,
        'áéíóúàèìòùäëïöüÁÉÍÓÚÀÈÌÒÙÄËÏÖÜñÑ',
        'aeiouaeiouaeiouAEIOUAEIOUAEIOUNN'
      ),
      '[^A-Z0-9 ]', ' ', 'g'
    )
  );
$$;
