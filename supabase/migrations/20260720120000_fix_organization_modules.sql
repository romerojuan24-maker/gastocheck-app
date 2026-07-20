-- ============================================================================
-- FASE 2b — Repara organization_modules (auditoría 2026-07-20)
--
-- Hallazgo: la migración 20260618300004_advisor_and_modules.sql (que crea
-- organization_modules) nunca se aplicó en producción -- la tabla no existe
-- en la BD viva pese a estar en el historial de migraciones del repo (mismo
-- patrón de migración fantasma documentado en 20260712100000).
--
-- Efecto observado: apps/mobile/app/equipo.tsx consulta organization_modules
-- para saber si la empresa tiene GastoCheck/CobraCheck activos y decidir qué
-- roles se pueden invitar. Al fallar la tabla, la consulta regresa vacío,
-- hasGastoCheck/hasCobraCheck quedan en false, y 'spender' (Comprador) y
-- 'collector' (Cobrador) desaparecen del selector de invitación -- solo
-- quedan admin/contador general/contador de módulo.
--
-- Idempotente: seguro re-ejecutar. Pegar completo en Supabase SQL Editor.
-- ============================================================================

-- ── 1. Tabla (copia exacta de la migración que nunca aplicó) ────────────────

CREATE TABLE IF NOT EXISTS organization_modules (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id               text NOT NULL,
  -- gastocheck | cobracheck | bancocheck | flujocheck | facturacheck | inventariocheck | advisor
  is_active               boolean NOT NULL DEFAULT false,
  stripe_subscription_id  text,
  trial_ends_at           timestamptz,
  activated_at            timestamptz,
  deactivated_at          timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_org_modules_company ON organization_modules(company_id);

-- ── 2. Backfill: todas las empresas existentes tienen GastoCheck y
--       CobraCheck activos (mismo comportamiento que asumía el default
--       hasGastoCheck=true/hasCobraCheck=true en equipo.tsx antes del bug) ──

INSERT INTO organization_modules (company_id, module_id, is_active, activated_at)
SELECT id, 'gastocheck', true, now() FROM companies
ON CONFLICT (company_id, module_id) DO NOTHING;

INSERT INTO organization_modules (company_id, module_id, is_active, activated_at)
SELECT id, 'cobracheck', true, now() FROM companies
ON CONFLICT (company_id, module_id) DO NOTHING;

-- ── 3. Trigger: nuevas empresas activan gastocheck+cobracheck automático ────

CREATE OR REPLACE FUNCTION activate_default_modules()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO organization_modules (company_id, module_id, is_active, trial_ends_at)
  VALUES
    (NEW.id, 'gastocheck',      true,  now() + interval '30 days'),
    (NEW.id, 'cobracheck',      true,  now() + interval '30 days'),
    (NEW.id, 'bancocheck',      false, null),
    (NEW.id, 'flujocheck',      false, null),
    (NEW.id, 'facturacheck',    false, null),
    (NEW.id, 'inventariocheck', false, null),
    (NEW.id, 'advisor',         false, null)
  ON CONFLICT (company_id, module_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_default_modules ON companies;
CREATE TRIGGER trg_company_default_modules
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION activate_default_modules();

DROP TRIGGER IF EXISTS trg_org_modules_updated_at ON organization_modules;
CREATE TRIGGER trg_org_modules_updated_at
  BEFORE UPDATE ON organization_modules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── 4. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE organization_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "member_see_org_modules" ON organization_modules;
CREATE POLICY "member_see_org_modules" ON organization_modules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members m
      WHERE m.company_id = organization_modules.company_id
        AND m.user_id    = auth.uid()
        AND m.status     = 'active'
    )
  );

DROP POLICY IF EXISTS "admin_manage_org_modules" ON organization_modules;
CREATE POLICY "admin_manage_org_modules" ON organization_modules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM company_members m
      WHERE m.company_id = organization_modules.company_id
        AND m.user_id    = auth.uid()
        AND m.status     = 'active'
        AND m.role IN ('owner','admin')
    )
  );

NOTIFY pgrst, 'reload schema';
