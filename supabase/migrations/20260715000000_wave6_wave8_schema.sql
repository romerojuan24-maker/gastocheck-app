-- Check Advisor Wave 6 & Wave 8 — Database Schema
--
-- Wave 6: Role-differentiated task screens (advisor_tasks)
-- Wave 8: Automatic signal publication (advisor_signal_queue, advisor_correlate_cooldown)
--
-- IMPORTANT: This migration assumes advisor_insights, business_signals, and
-- advisor_actions tables already exist from OTA 206 migrations.

-- ─────────────────────────────────────────────────────────────────────────────
-- Wave 6: ADVISOR_TASKS — Task ownership and assignment
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists advisor_tasks (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references companies(id) on delete cascade,
  insight_id          uuid not null references advisor_insights(id) on delete cascade,

  -- Task assignment: either assigned to user OR role (not both)
  assigned_to_user_id uuid references auth.users(id) on delete set null,
  assigned_to_role    text,
  -- Values: 'supervisor', 'operator', 'comprador', 'spender', 'collector', 'accountant', etc.

  -- Task workflow
  created_by_user_id  uuid not null references auth.users(id) on delete cascade,
  task_status         text not null default 'PENDING',
  -- PENDING | IN_PROGRESS | COMPLETED | DELEGATED | DISMISSED

  -- Metadata
  task_priority       int default 0,
  -- Override insight priority (0 = use insight.priority_score)
  notes               text,
  due_date            date,

  -- Audit timestamps
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  viewed_at           timestamptz,
  completed_at        timestamptz,

  -- Ensure one task per insight per company
  unique(company_id, insight_id)
);

create index if not exists idx_tasks_user_assigned
  on advisor_tasks(assigned_to_user_id, task_status)
  where assigned_to_user_id is not null;

create index if not exists idx_tasks_role_assigned
  on advisor_tasks(company_id, assigned_to_role, task_status)
  where assigned_to_role is not null;

create index if not exists idx_tasks_company_active
  on advisor_tasks(company_id, task_status)
  where task_status in ('PENDING', 'IN_PROGRESS');

alter table advisor_tasks enable row level security;

-- RLS: Users see tasks assigned to them (by user_id or role match)
drop policy if exists "user_see_own_tasks" on advisor_tasks;
create policy "user_see_own_tasks" on advisor_tasks for select using (
  -- Case 1: Task assigned to current user
  assigned_to_user_id = auth.uid()
  or
  -- Case 2: Task assigned by role, and user has that role
  (assigned_to_role is not null and exists (
    select 1 from company_members m
    where m.company_id = advisor_tasks.company_id
      and m.user_id = auth.uid()
      and m.role = advisor_tasks.assigned_to_role
      and m.status = 'active'
  ))
  or
  -- Case 3: Supervisors/Admins see all company tasks
  exists (
    select 1 from company_members m
    where m.company_id = advisor_tasks.company_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'supervisor', 'accountant', 'contador_general')
      and m.status = 'active'
  )
);

-- RLS: Only assigned user or supervisor can update task
drop policy if exists "manage_task_if_assigned_or_supervisor" on advisor_tasks;
create policy "manage_task_if_assigned_or_supervisor" on advisor_tasks for update using (
  auth.uid() = assigned_to_user_id
  or exists (
    select 1 from company_members m
    where m.company_id = advisor_tasks.company_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin', 'supervisor', 'accountant', 'contador_general')
      and m.status = 'active'
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Wave 8: ADVISOR_SIGNAL_QUEUE — Async correlation job queue
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists advisor_signal_queue (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  signal_id       uuid references business_signals(id) on delete set null,

  -- Type of event that triggered the signal
  event_type      text not null,
  -- Examples: EXPENSE_CREATED, INVOICE_CREATED, PAYMENT_RECEIVED, TRANSACTION_MATCHED, etc.

  -- Processing metadata
  status          text not null default 'PENDING',
  -- PENDING | PROCESSING | COMPLETED | FAILED

  retries         int default 0,
  max_retries     int default 3,
  last_error      text,

  -- Timestamps
  queued_at       timestamptz not null default now(),
  processed_at    timestamptz,

  -- Prevent duplicate processing of same signal
  unique(company_id, signal_id) where signal_id is not null
);

create index if not exists idx_signal_queue_pending
  on advisor_signal_queue(company_id, status)
  where status = 'PENDING';

create index if not exists idx_signal_queue_company
  on advisor_signal_queue(company_id, queued_at desc)
  where status in ('PENDING', 'PROCESSING');

-- ─────────────────────────────────────────────────────────────────────────────
-- Wave 8: ADVISOR_CORRELATE_COOLDOWN — Rate limiting (60s per company)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists advisor_correlate_cooldown (
  company_id      uuid primary key references companies(id) on delete cascade,
  last_run_at     timestamptz,
  next_allowed_at timestamptz,
  updated_at      timestamptz not null default now()
);

create index if not exists idx_correlate_cooldown_next
  on advisor_correlate_cooldown(next_allowed_at)
  where next_allowed_at is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Link advisor_insights to advisor_tasks
-- ─────────────────────────────────────────────────────────────────────────────

alter table advisor_insights
  add column if not exists task_id uuid references advisor_tasks(id) on delete set null;

create index if not exists idx_insights_task
  on advisor_insights(task_id)
  where task_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: create_advisor_task
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function create_advisor_task(
  p_company_id uuid,
  p_insight_id uuid,
  p_assigned_to_user_id uuid default null,
  p_assigned_to_role text default null
) returns advisor_tasks as $$
declare
  v_task advisor_tasks;
  v_user_id uuid;
begin
  -- Verify current user is member of the company and has permission
  select auth.uid() into v_user_id;

  if not exists (
    select 1 from company_members m
    where m.company_id = p_company_id
      and m.user_id = v_user_id
      and m.role in ('owner','admin','supervisor','accountant','contador_general')
      and m.status = 'active'
  ) then
    raise exception 'Insufficient permissions to create task';
  end if;

  -- Verify insight belongs to this company
  if not exists (
    select 1 from advisor_insights
    where id = p_insight_id and company_id = p_company_id
  ) then
    raise exception 'Insight not found in this company';
  end if;

  -- Create task (upsert on company_id, insight_id)
  insert into advisor_tasks (
    company_id, insight_id, assigned_to_user_id, assigned_to_role, created_by_user_id, task_status
  ) values (
    p_company_id, p_insight_id, p_assigned_to_user_id, p_assigned_to_role, v_user_id, 'PENDING'
  )
  on conflict (company_id, insight_id) do update set
    assigned_to_user_id = coalesce(p_assigned_to_user_id, advisor_tasks.assigned_to_user_id),
    assigned_to_role = coalesce(p_assigned_to_role, advisor_tasks.assigned_to_role),
    updated_at = now()
  returning * into v_task;

  return v_task;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: update_task_status
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function update_task_status(
  p_task_id uuid,
  p_new_status text,
  p_notes text default null
) returns advisor_tasks as $$
declare
  v_task advisor_tasks;
  v_user_id uuid;
begin
  select auth.uid() into v_user_id;

  -- Verify user can update this task
  if not exists (
    select 1 from advisor_tasks t
    where t.id = p_task_id
      and (
        t.assigned_to_user_id = v_user_id
        or exists (
          select 1 from company_members m
          where m.company_id = t.company_id
            and m.user_id = v_user_id
            and m.role in ('owner','admin','supervisor','accountant','contador_general')
            and m.status = 'active'
        )
      )
  ) then
    raise exception 'Cannot update this task';
  end if;

  -- Update task status
  update advisor_tasks
  set
    task_status = p_new_status,
    notes = coalesce(p_notes, notes),
    updated_at = now(),
    completed_at = case when p_new_status = 'COMPLETED' then now() else completed_at end
  where id = p_task_id
  returning * into v_task;

  return v_task;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: check_correlate_ratelimit — Verify if correlate can run
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function check_correlate_ratelimit(p_company_id uuid)
returns boolean as $$
declare
  v_next_allowed timestamptz;
begin
  select next_allowed_at into v_next_allowed
  from advisor_correlate_cooldown
  where company_id = p_company_id;

  -- If no record exists, always allow
  if v_next_allowed is null then
    return true;
  end if;

  -- Allow if cooldown has expired
  return now() >= v_next_allowed;
end;
$$ language plpgsql stable;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: update_correlate_cooldown — Set 60-second rate limit
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function update_correlate_cooldown(p_company_id uuid)
returns void as $$
begin
  insert into advisor_correlate_cooldown (company_id, last_run_at, next_allowed_at)
  values (p_company_id, now(), now() + interval '60 seconds')
  on conflict (company_id) do update set
    last_run_at = now(),
    next_allowed_at = now() + interval '60 seconds',
    updated_at = now();
end;
$$ language plpgsql;
