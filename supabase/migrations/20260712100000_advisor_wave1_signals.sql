-- Check Advisor — Wave 1 (Foundation): señales de negocio, insights
-- correlacionados, acciones, corridas del motor.
--
-- Hallazgo: la migración 20260618300004_advisor_and_modules.sql (advisor_
-- insights/advisor_questions/organization_modules) NUNCA se aplicó en
-- producción — las 3 tablas no existen pese a estar en el historial de
-- migraciones del repo. advisor-ask y la página web de Advisor son stubs
-- que nunca funcionaron contra datos reales. Se crea aquí advisor_insights
-- (la única que este Wave necesita) con su esquema original + las
-- columnas nuevas del spec, en la misma migración.
--
-- Filosofía: LOS MÓDULOS CALCULAN. EL MOTOR CORRELACIONA. LA IA EXPLICA.
-- Esta migración construye las primeras dos capas (señales + correlación
-- determinística) — la capa de IA (Wave 7) vendrá después.

create table if not exists advisor_insights (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  insight_type  text not null,
  title         text not null,
  body          text not null,
  severity      text not null default 'info',     -- info | warning | critical
  module        text not null,
  action_url    text,
  related_ids   jsonb,
  is_dismissed  boolean not null default false,
  is_actioned   boolean not null default false,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists idx_advisor_insights_company on advisor_insights(company_id, is_dismissed);
create index if not exists idx_advisor_insights_severity on advisor_insights(company_id, severity);
alter table advisor_insights enable row level security;

-- ── BUSINESS_SIGNALS: hechos crudos publicados por cada módulo ───────────
create table if not exists business_signals (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  source_module       text not null,
  -- gastocheck | cobracheck | bancocheck | flujocheck | facturacheck | inventariocheck | nominacheck | system
  signal_type         text not null,
  -- PAYROLL_DUE | PROJECTED_CASH_DEFICIT | OVERDUE_RECEIVABLES_HIGH | PLANNED_INVENTORY_PURCHASE | etc.
  severity            text not null default 'INFO',  -- INFO | LOW | MEDIUM | HIGH | CRITICAL
  entity_type         text,
  entity_id           uuid,
  title               text not null,
  value_decimal       numeric(15,2),
  value_text          text,
  currency            text not null default 'MXN',
  effective_date      date not null default current_date,
  expires_at          timestamptz,
  status              text not null default 'ACTIVE',  -- ACTIVE | RESOLVED | EXPIRED | DISMISSED | SUPERSEDED
  evidence_json        jsonb,
  metadata_json        jsonb,
  deduplication_key    text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists idx_signals_dedup
  on business_signals(company_id, deduplication_key)
  where deduplication_key is not null and status = 'ACTIVE';

create index if not exists idx_signals_company_status on business_signals(company_id, status);
create index if not exists idx_signals_type on business_signals(company_id, signal_type, status);

-- ── ADVISOR_INSIGHTS: extender la tabla existente (no reemplazar) ────────
alter table advisor_insights
  add column if not exists priority_score        numeric(5,2) not null default 0,
  add column if not exists confidence            numeric(5,2) not null default 100,
  add column if not exists explanation           text,
  add column if not exists status                text not null default 'ACTIVE',
  -- NEW | ACTIVE | VIEWED | ACTIONED | RESOLVED | DISMISSED | EXPIRED
  add column if not exists role_scope            text[] not null default array['owner','admin'],
  add column if not exists related_signal_ids    uuid[],
  add column if not exists correlation_rule_id   text,
  add column if not exists generated_by          text not null default 'RULE_ENGINE',
  -- RULE_ENGINE | AI_EXPLANATION | HYBRID
  add column if not exists deduplication_key     text,
  add column if not exists resolved_at           timestamptz,
  add column if not exists dismissed_at          timestamptz,
  add column if not exists viewed_at             timestamptz;

create unique index if not exists idx_insights_dedup
  on advisor_insights(company_id, deduplication_key)
  where deduplication_key is not null and status not in ('RESOLVED', 'DISMISSED', 'EXPIRED');

-- ── ADVISOR_ACTIONS: acciones que resuelven un insight ────────────────────
create table if not exists advisor_actions (
  id           uuid primary key default gen_random_uuid(),
  insight_id   uuid not null references advisor_insights(id) on delete cascade,
  action_type  text not null,
  label        text not null,
  route        text,
  entity_type  text,
  entity_id    uuid,
  priority     int not null default 0,
  status       text not null default 'AVAILABLE',  -- AVAILABLE | STARTED | COMPLETED | DISMISSED
  created_at   timestamptz not null default now()
);
create index if not exists idx_actions_insight on advisor_actions(insight_id);

-- ── ADVISOR_RUNS: auditoría de cada corrida del motor de correlación ─────
create table if not exists advisor_runs (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references companies(id) on delete cascade,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  signals_evaluated  int not null default 0,
  insights_created   int not null default 0,
  insights_updated   int not null default 0,
  insights_resolved  int not null default 0,
  status             text not null default 'running',  -- running | completed | failed
  error_json         jsonb
);
create index if not exists idx_advisor_runs_company on advisor_runs(company_id, started_at desc);

-- ── ADVISOR_CORRELATION_RULES: catálogo/versión (lógica vive en la Edge
-- Function advisor-correlate — esta tabla es metadata para observabilidad,
-- no un motor de reglas dinámico completo, eso sería sobre-ingeniería
-- para Wave 1).
create table if not exists advisor_correlation_rules (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  version      int not null default 1,
  name         text not null,
  description  text,
  is_active    boolean not null default true,
  required_signals text[] not null,
  optional_signals text[],
  output_insight_type text not null,
  default_severity    text not null default 'MEDIUM',
  created_at   timestamptz not null default now()
);

insert into advisor_correlation_rules (code, name, description, required_signals, optional_signals, output_insight_type, default_severity) values
  ('PAYROLL_AT_RISK', 'Nómina en riesgo',
   'Nómina próxima + déficit de flujo proyectado',
   array['PAYROLL_DUE','PROJECTED_CASH_DEFICIT'],
   array['OVERDUE_RECEIVABLES_HIGH','PLANNED_INVENTORY_PURCHASE','EXPECTED_CASH_INFLOW'],
   'PAYROLL_AT_RISK', 'CRITICAL'),
  ('COLLECTION_CAUSING_CASH_PRESSURE', 'Cobranza vencida presiona el flujo',
   'Riesgo de flujo + cartera vencida alta',
   array['CASH_FLOW_RISK','OVERDUE_RECEIVABLES_HIGH'],
   null, 'COLLECTION_CAUSING_CASH_PRESSURE', 'HIGH'),
  ('INVENTORY_PURCHASE_CASH_CONFLICT', 'Compra de inventario en conflicto con el flujo',
   'Compra de inventario planeada + riesgo de flujo',
   array['PLANNED_INVENTORY_PURCHASE','CASH_FLOW_RISK'],
   null, 'INVENTORY_PURCHASE_CASH_CONFLICT', 'HIGH')
on conflict (code) do nothing;

-- ── RLS ────────────────────────────────────────────────────────────────
alter table business_signals            enable row level security;
alter table advisor_actions             enable row level security;
alter table advisor_runs                enable row level security;
alter table advisor_correlation_rules   enable row level security;

drop policy if exists "member_see_signals" on business_signals;
create policy "member_see_signals" on business_signals for select using (
  exists (select 1 from company_members m where m.company_id = business_signals.company_id and m.user_id = auth.uid() and m.status = 'active')
);

drop policy if exists "member_see_actions" on advisor_actions;
create policy "member_see_actions" on advisor_actions for select using (
  exists (
    select 1 from advisor_insights i
    join company_members m on m.company_id = i.company_id
    where i.id = advisor_actions.insight_id and m.user_id = auth.uid() and m.status = 'active'
  )
);
drop policy if exists "member_update_actions" on advisor_actions;
create policy "member_update_actions" on advisor_actions for update using (
  exists (
    select 1 from advisor_insights i
    join company_members m on m.company_id = i.company_id
    where i.id = advisor_actions.insight_id and m.user_id = auth.uid() and m.status = 'active'
  )
);

drop policy if exists "member_see_runs" on advisor_runs;
create policy "member_see_runs" on advisor_runs for select using (
  exists (select 1 from company_members m where m.company_id = advisor_runs.company_id and m.user_id = auth.uid() and m.status = 'active')
);

drop policy if exists "everyone_see_rules" on advisor_correlation_rules;
create policy "everyone_see_rules" on advisor_correlation_rules for select using (true);

-- Corrige rol-drift: advisor_insights excluía 'contador_general' (mismo
-- patrón corregido ya esta noche en BancoCheck/FacturaCheck).
drop policy if exists "member_see_insights" on advisor_insights;
create policy "member_see_insights" on advisor_insights for select using (
  exists (
    select 1 from company_members m
    where m.company_id = advisor_insights.company_id and m.user_id = auth.uid() and m.status = 'active'
      and (advisor_insights.role_scope is null or m.role::text = any(advisor_insights.role_scope))
  )
);
drop policy if exists "member_manage_insights" on advisor_insights;
create policy "member_manage_insights" on advisor_insights for update using (
  exists (
    select 1 from company_members m
    where m.company_id = advisor_insights.company_id and m.user_id = auth.uid() and m.status = 'active'
      and m.role in ('owner','admin','supervisor','accountant','contador_general')
  )
);
