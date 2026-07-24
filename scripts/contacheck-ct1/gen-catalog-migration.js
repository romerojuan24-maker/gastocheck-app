// Genera la migración SQL de la plantilla de catálogo SAT desde el CSV.
const fs = require('fs');
const CSV = process.argv[2];
const OUT = process.argv[3];

const lines = fs.readFileSync(CSV, 'utf8').split(/\r?\n/).filter(Boolean);
const header = lines.shift().split(',');
// columnas: code,name,name_en,parent_code,account_type,nature,level,sat_grouping_code,is_postable

function parseCsvLine(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
  }
  out.push(cur); return out;
}

// account_type (español) -> account_type_norm (enum) + nature
const NORM = { Activo:'activo', Pasivo:'pasivo', Capital:'patrimonio', Ingresos:'ingreso', Costos:'costo', Gastos:'egreso' };
const NATURE = { activo:'deudora', costo:'deudora', egreso:'deudora', pasivo:'acreedora', patrimonio:'acreedora', ingreso:'acreedora' };
const sqlStr = v => v === '' || v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

const rows = lines.map(l => {
  const f = parseCsvLine(l);
  const rec = {}; header.forEach((h, i) => rec[h] = f[i]);
  const norm = NORM[rec.account_type] ?? null;   // Orden/Resultados -> NULL (fuera del enum)
  const nature = norm ? NATURE[norm] : null;
  return { code: rec.code, name: rec.name, parent: rec.parent_code || null,
           atype: rec.account_type, norm, nature, level: rec.level || '1',
           sat: rec.sat_grouping_code || null, postable: rec.is_postable === 'true' };
});

const values = rows.map(r =>
  `  (${sqlStr(r.code)}, ${sqlStr(r.name)}, ${sqlStr(r.parent)}, ${sqlStr(r.atype)}, ${sqlStr(r.norm)}, ${sqlStr(r.nature)}, ${r.level}, ${sqlStr(r.sat)}, ${r.postable})`
).join(',\n');

const sql = `-- ============================================================================
-- CONTACHECK CT1 — Plantilla de catálogo SAT genérico + importación por empresa
-- ----------------------------------------------------------------------------
-- Catálogo genérico (código agrupador SAT / Anexo 24) derivado del COI de CONTPAQ
-- que el cliente usa para enviar contabilidad al SAT. Sin subcuentas personales.
-- ${rows.length} cuentas · ${rows.filter(r=>r.sat).length} con código agrupador · ${rows.filter(r=>r.postable).length} afectables.
-- Fuente: supabase/seed/sat_chart_of_accounts.csv (scripts/contacheck-ct1/parse-coi-catalog.js)
--
-- accounting_accounts es POR EMPRESA; esta plantilla es única y se copia a cada
-- empresa vía accounting_import_sat_catalog(company). Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.accounting_sat_catalog_template (
  code              text PRIMARY KEY,
  name              text NOT NULL,
  parent_code       text,
  account_type      text,             -- etiqueta original (Activo/Pasivo/...)
  account_type_norm text,             -- enum accounting_accounts (activo/pasivo/...)
  nature            text,             -- deudora/acreedora
  level             integer NOT NULL DEFAULT 1,
  sat_grouping_code varchar(10),      -- código agrupador SAT (Anexo 24)
  is_postable       boolean NOT NULL DEFAULT true
);

-- Catálogo de solo lectura para clientes autenticados (referencia).
ALTER TABLE public.accounting_sat_catalog_template ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sat_catalog_read ON public.accounting_sat_catalog_template;
CREATE POLICY sat_catalog_read ON public.accounting_sat_catalog_template FOR SELECT USING (true);
REVOKE ALL ON public.accounting_sat_catalog_template FROM PUBLIC, anon;
GRANT SELECT ON public.accounting_sat_catalog_template TO authenticated;
GRANT ALL    ON public.accounting_sat_catalog_template TO service_role;

-- Semilla (idempotente: reemplaza la plantilla completa)
TRUNCATE public.accounting_sat_catalog_template;
INSERT INTO public.accounting_sat_catalog_template
  (code, name, parent_code, account_type, account_type_norm, nature, level, sat_grouping_code, is_postable)
VALUES
${values};

-- ── Importar el catálogo a una empresa ──────────────────────────────────────
-- Copia las cuentas de la plantilla a accounting_accounts de la empresa.
-- Idempotente (ON CONFLICT sobre (company_id, code) no pisa lo existente).
-- Requiere rol contable (misma política que "manage accounts").
CREATE OR REPLACE FUNCTION public.accounting_import_sat_catalog(p_company uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_inserted int;
BEGIN
  IF public.auth_role(p_company) NOT IN ('owner','accountant','admin') THEN
    RAISE EXCEPTION 'Solo rol contable puede importar el catálogo' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.accounting_accounts
    (company_id, code, name, parent_code, account_type, account_type_norm, nature,
     level, sat_grouping_code, is_postable, active)
  SELECT p_company, t.code, t.name, t.parent_code, t.account_type, t.account_type_norm,
         t.nature, t.level, t.sat_grouping_code, t.is_postable, true
  FROM public.accounting_sat_catalog_template t
  ON CONFLICT (company_id, code) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN jsonb_build_object('ok', true, 'inserted', v_inserted,
                            'template_total', (SELECT count(*) FROM public.accounting_sat_catalog_template));
END; $$;
REVOKE EXECUTE ON FUNCTION public.accounting_import_sat_catalog(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.accounting_import_sat_catalog(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
`;

fs.writeFileSync(OUT, sql, 'utf8');
console.log('rows:', rows.length, '| con SAT:', rows.filter(r=>r.sat).length, '| postable:', rows.filter(r=>r.postable).length);
console.log('norm nulos (Orden/Resultados):', rows.filter(r=>!r.norm).length);
console.log('written:', OUT);
