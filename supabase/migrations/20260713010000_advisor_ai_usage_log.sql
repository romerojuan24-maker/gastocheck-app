-- Check Advisor Wave 7 — registro de uso de IA (Sección 33 del spec).
-- Permite saber costo por tenant/módulo/insight cuando se active
-- facturación de este consumo.
create table if not exists advisor_ai_usage_log (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references companies(id) on delete cascade,
  insight_id     uuid references advisor_insights(id) on delete set null,
  provider       text not null,   -- gemini | openai | anthropic | mock
  model          text not null,
  prompt_version text not null,
  tokens_input   int,
  tokens_output  int,
  created_at     timestamptz not null default now()
);
create index if not exists idx_advisor_ai_usage_company on advisor_ai_usage_log(company_id, created_at desc);

alter table advisor_ai_usage_log enable row level security;
drop policy if exists "member_see_ai_usage" on advisor_ai_usage_log;
create policy "member_see_ai_usage" on advisor_ai_usage_log for select using (
  exists (
    select 1 from company_members m
    where m.company_id = advisor_ai_usage_log.company_id and m.user_id = auth.uid() and m.status = 'active'
      and m.role in ('owner','admin')
  )
);
