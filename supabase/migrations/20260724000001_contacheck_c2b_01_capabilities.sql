-- ContaCheck C2B · Bloque 1 — Capacidades y autorización (aditivo, idempotente)
-- Reutiliza el patrón de capacidades de NóminaCheck. No toca objetos existentes.

create table if not exists public.accounting_capabilities (
  key         text primary key,
  description text not null
);

insert into public.accounting_capabilities(key, description) values
  ('accounting.view',          'Ver contabilidad'),
  ('accounting.configure',     'Configurar catálogo y reglas'),
  ('accounting.generate',      'Generar pólizas'),
  ('accounting.review',        'Revisar pólizas'),
  ('accounting.approve',       'Aprobar pólizas'),
  ('accounting.post',          'Contabilizar pólizas'),
  ('accounting.reverse',       'Reversar pólizas'),
  ('accounting.close_period',  'Cerrar periodos'),
  ('accounting.reopen_period', 'Reabrir periodos'),
  ('accounting.audit',         'Auditar contabilidad'),
  ('accounting.admin',         'Administrar contabilidad')
on conflict (key) do nothing;

create table if not exists public.accounting_role_capabilities (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid references public.companies(id) on delete cascade, -- null = default global
  role           public.member_role not null,
  capability_key text not null references public.accounting_capabilities(key)
);
-- unicidad tolerante a NULL (defaults globales)
create unique index if not exists uq_acc_role_caps_global
  on public.accounting_role_capabilities(role, capability_key) where company_id is null;
create unique index if not exists uq_acc_role_caps_company
  on public.accounting_role_capabilities(company_id, role, capability_key) where company_id is not null;

create table if not exists public.accounting_user_capabilities (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies(id) on delete cascade,
  user_id        uuid not null,
  capability_key text not null references public.accounting_capabilities(key),
  granted_by     uuid,
  created_at     timestamptz not null default now(),
  unique (company_id, user_id, capability_key)
);

-- Defaults globales por rol (conservadores, con segregación aplicada en RPC)
do $$
declare
  v_map jsonb := jsonb_build_object(
    'owner',            to_jsonb(array['accounting.view','accounting.configure','accounting.generate','accounting.review','accounting.approve','accounting.post','accounting.reverse','accounting.close_period','accounting.reopen_period','accounting.audit','accounting.admin']),
    'contador_general', to_jsonb(array['accounting.view','accounting.configure','accounting.generate','accounting.review','accounting.approve','accounting.post','accounting.reverse','accounting.close_period','accounting.audit']),
    'accountant',       to_jsonb(array['accounting.view','accounting.generate','accounting.review','accounting.approve','accounting.post','accounting.audit']),
    'admin',            to_jsonb(array['accounting.view','accounting.configure','accounting.audit'])
  );
  v_role text;
  v_cap  text;
begin
  for v_role in select jsonb_object_keys(v_map) loop
    for v_cap in select jsonb_array_elements_text(v_map->v_role) loop
      insert into public.accounting_role_capabilities(company_id, role, capability_key)
      select null, v_role::public.member_role, v_cap
      where not exists (
        select 1 from public.accounting_role_capabilities
        where company_id is null and role = v_role::public.member_role and capability_key = v_cap
      );
    end loop;
  end loop;
end $$;

-- accounting_can: override de usuario OR mapeo por rol (global o por empresa)
create or replace function public.accounting_can(p_company uuid, p_capability text)
returns boolean
language sql stable security definer set search_path = pg_catalog, public as $$
  select exists (
      select 1 from public.accounting_user_capabilities uc
       where uc.company_id = p_company and uc.user_id = auth.uid() and uc.capability_key = p_capability
  ) or exists (
      select 1
        from public.company_members m
        join public.accounting_role_capabilities rc
          on rc.role = m.role
         and rc.capability_key = p_capability
         and (rc.company_id = p_company or rc.company_id is null)
       where m.company_id = p_company and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

revoke all on function public.accounting_can(uuid, text) from public, anon;
grant execute on function public.accounting_can(uuid, text) to authenticated, service_role;

alter table public.accounting_capabilities      enable row level security;
alter table public.accounting_role_capabilities enable row level security;
alter table public.accounting_user_capabilities enable row level security;
