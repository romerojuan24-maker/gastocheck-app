-- ─────────────────────────────────────────────────────────────────────────────
-- Advisor IA + módulos de billing por empresa
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists advisor_insights (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references companies(id) on delete cascade,
  insight_type  text not null,
  -- collections_priority | unusual_expense | unmatched_bank | cash_flow_risk
  -- cfdi_problem | low_stock | action_item | overdue_payment | budget_alert
  title         text not null,
  body          text not null,
  severity      text not null default 'info',     -- info | warning | critical
  module        text not null,
  -- gastocheck | cobracheck | bancocheck | flujocheck | facturacheck | inventariocheck
  action_url    text,                              -- ruta dentro de la app
  related_ids   jsonb,                             -- ids de registros relacionados
  is_dismissed  boolean not null default false,
  is_actioned   boolean not null default false,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table if not exists advisor_questions (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,
  user_id          uuid not null references profiles(id) on delete cascade,
  question         text not null,
  answer           text,
  status           text not null default 'pending',    -- pending | answered | error
  context_snapshot jsonb,  -- KPIs y datos del negocio en el momento de la pregunta
  created_at       timestamptz not null default now(),
  answered_at      timestamptz
);

-- ─────────────────────────────────────────────────────────────────────────────
-- organization_modules — billing por módulo
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists organization_modules (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references companies(id) on delete cascade,
  module_id             text not null,
  -- gastocheck | cobracheck | bancocheck | flujocheck | facturacheck | inventariocheck | advisor
  is_active             boolean not null default false,
  stripe_subscription_id text,
  trial_ends_at         timestamptz,
  activated_at          timestamptz,
  deactivated_at        timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_id, module_id)
);

-- Por defecto todas las empresas tienen gastocheck y cobracheck activos (free tier / trial)
create or replace function activate_default_modules()
returns trigger language plpgsql as $$
begin
  insert into organization_modules (company_id, module_id, is_active, trial_ends_at)
  values
    (new.id, 'gastocheck',     true, now() + interval '30 days'),
    (new.id, 'cobracheck',     true, now() + interval '30 days'),
    (new.id, 'bancocheck',     false, null),
    (new.id, 'flujocheck',     false, null),
    (new.id, 'facturacheck',   false, null),
    (new.id, 'inventariocheck',false, null),
    (new.id, 'advisor',        false, null)
  on conflict (company_id, module_id) do nothing;
  return new;
end;
$$;

create trigger trg_company_default_modules
  after insert on companies
  for each row execute function activate_default_modules();

-- ── Índices ───────────────────────────────────────────────────────────────────

create index if not exists idx_advisor_insights_company on advisor_insights(company_id, is_dismissed);
create index if not exists idx_advisor_insights_severity on advisor_insights(company_id, severity);
create index if not exists idx_advisor_questions_company on advisor_questions(company_id);
create index if not exists idx_org_modules_company on organization_modules(company_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table advisor_insights     enable row level security;
alter table advisor_questions    enable row level security;
alter table organization_modules enable row level security;

create policy "member_see_insights" on advisor_insights
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = advisor_insights.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','accountant')
    )
  );

create policy "member_manage_insights" on advisor_insights
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = advisor_insights.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin','supervisor','accountant')
    )
  );

create policy "user_own_questions" on advisor_questions
  for all using (
    user_id = auth.uid()
    and exists (
      select 1 from company_members m
      where m.company_id = advisor_questions.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
    )
  );

create policy "member_see_org_modules" on organization_modules
  for select using (
    exists (
      select 1 from company_members m
      where m.company_id = organization_modules.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
    )
  );

create policy "admin_manage_org_modules" on organization_modules
  for all using (
    exists (
      select 1 from company_members m
      where m.company_id = organization_modules.company_id
        and m.user_id    = auth.uid()
        and m.status     = 'active'
        and m.role in ('owner','admin')
    )
  );

-- ── Triggers ──────────────────────────────────────────────────────────────────

create trigger trg_org_modules_updated_at
  before update on organization_modules
  for each row execute function update_updated_at();
