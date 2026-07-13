-- Check Advisor — Wave 1: RPC para publicar señales con deduplicación.
-- Los módulos (o el usuario, en Wave 1 sin integración automática aún)
-- publican HECHOS aquí — nunca conclusiones. La correlación pasa
-- exclusivamente por la Edge Function advisor-correlate (determinística).

create or replace function advisor_publish_signal(
  p_company_id        uuid,
  p_source_module     text,
  p_signal_type       text,
  p_title             text,
  p_severity          text default 'INFO',
  p_value_decimal     numeric default null,
  p_value_text        text default null,
  p_entity_type       text default null,
  p_entity_id         uuid default null,
  p_evidence_json     jsonb default null,
  p_metadata_json     jsonb default null,
  p_deduplication_key text default null,
  p_expires_at        timestamptz default null
) returns business_signals
language plpgsql security definer set search_path = public as $$
declare
  v_signal business_signals;
begin
  if not exists (
    select 1 from company_members
    where company_id = p_company_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'Sin acceso a esta empresa';
  end if;
  if p_severity not in ('INFO','LOW','MEDIUM','HIGH','CRITICAL') then
    raise exception 'Severidad inválida: %', p_severity;
  end if;

  if p_deduplication_key is not null then
    update business_signals set
      title = p_title, severity = p_severity, value_decimal = p_value_decimal,
      value_text = p_value_text, evidence_json = p_evidence_json, metadata_json = p_metadata_json,
      expires_at = p_expires_at, updated_at = now()
    where company_id = p_company_id and deduplication_key = p_deduplication_key and status = 'ACTIVE'
    returning * into v_signal;
    if found then return v_signal; end if;
  end if;

  insert into business_signals (
    company_id, source_module, signal_type, severity, entity_type, entity_id,
    title, value_decimal, value_text, evidence_json, metadata_json, deduplication_key, expires_at
  ) values (
    p_company_id, p_source_module, p_signal_type, p_severity, p_entity_type, p_entity_id,
    p_title, p_value_decimal, p_value_text, p_evidence_json, p_metadata_json, p_deduplication_key, p_expires_at
  ) returning * into v_signal;

  return v_signal;
end;
$$;

create or replace function advisor_resolve_signal(p_signal_id uuid)
returns business_signals
language plpgsql security definer set search_path = public as $$
declare
  v_signal business_signals;
  v_company_id uuid;
begin
  select company_id into v_company_id from business_signals where id = p_signal_id;
  if v_company_id is null then raise exception 'Señal no encontrada'; end if;
  if not exists (
    select 1 from company_members
    where company_id = v_company_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'Sin acceso a esta empresa';
  end if;

  update business_signals set status = 'RESOLVED', updated_at = now()
  where id = p_signal_id returning * into v_signal;
  return v_signal;
end;
$$;

create table if not exists advisor_feedback_log (
  id            uuid primary key default gen_random_uuid(),
  insight_id    uuid not null references advisor_insights(id) on delete cascade,
  user_id       uuid references auth.users(id),
  feedback_type text not null,  -- HELPFUL | NOT_HELPFUL | INCORRECT | NOT_RELEVANT | ALREADY_KNOWN | ACTION_TAKEN | DISMISSED
  reason        text,
  metadata_json jsonb,
  created_at    timestamptz not null default now()
);
alter table advisor_feedback_log enable row level security;
drop policy if exists "member_see_feedback" on advisor_feedback_log;
create policy "member_see_feedback" on advisor_feedback_log for select using (
  exists (
    select 1 from advisor_insights i
    join company_members m on m.company_id = i.company_id
    where i.id = advisor_feedback_log.insight_id and m.user_id = auth.uid() and m.status = 'active'
  )
);

create or replace function advisor_dismiss_insight(p_insight_id uuid, p_reason text default null)
returns advisor_insights
language plpgsql security definer set search_path = public as $$
declare
  v_insight advisor_insights;
  v_company_id uuid;
begin
  select company_id into v_company_id from advisor_insights where id = p_insight_id;
  if v_company_id is null then raise exception 'Insight no encontrado'; end if;
  if not exists (
    select 1 from company_members
    where company_id = v_company_id and user_id = auth.uid() and status = 'active'
      and role in ('owner','admin','supervisor','accountant','contador_general')
  ) then
    raise exception 'Sin permiso para descartar este insight';
  end if;

  update advisor_insights set
    status = 'DISMISSED', is_dismissed = true, dismissed_at = now()
  where id = p_insight_id returning * into v_insight;

  insert into advisor_feedback_log (insight_id, user_id, feedback_type, reason)
  values (p_insight_id, auth.uid(), 'DISMISSED', p_reason);

  return v_insight;
end;
$$;

grant execute on function advisor_publish_signal(uuid, text, text, text, text, numeric, text, text, uuid, jsonb, jsonb, text, timestamptz) to authenticated;
grant execute on function advisor_resolve_signal(uuid) to authenticated;
grant execute on function advisor_dismiss_insight(uuid, text) to authenticated;
