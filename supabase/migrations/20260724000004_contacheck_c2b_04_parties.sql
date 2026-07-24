-- ContaCheck C2B · Bloque 4 — parties + party_links (identidad transversal, no invasiva)
-- No copia toda la info operativa; RFC de empleado NUNCA en claro (hash + last4).

create table if not exists public.parties (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies(id) on delete restrict,
  party_type           text not null check (party_type in ('persona_fisica','persona_moral','extranjero','generico')),
  display_name         text not null,
  legal_name           text,
  rfc_normalized       text,
  tax_id_hash          text,
  tax_id_last4         text,
  regimen_fiscal       varchar(10),
  codigo_postal        varchar(10),
  country_code         varchar(3) not null default 'MEX',
  email                text,
  status               text not null default 'active' check (status in ('active','inactive','merged')),
  merged_into_party_id uuid references public.parties(id),
  source               text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
-- Dedup por RFC (no genéricos, no fusionados); fallback por nombre lo maneja la RPC.
create unique index if not exists uq_parties_company_rfc
  on public.parties(company_id, rfc_normalized)
  where rfc_normalized is not null and status <> 'merged';
create index if not exists idx_parties_company on public.parties(company_id);
create index if not exists idx_parties_hash on public.parties(company_id, tax_id_hash) where tax_id_hash is not null;

create table if not exists public.party_links (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete restrict,
  party_id     uuid not null references public.parties(id) on delete restrict,
  module       varchar(50) not null,
  entity_table varchar(64) not null,
  entity_id    uuid not null,
  role         varchar(24) not null check (role in ('cliente','proveedor','empleado','contraparte','acreedor','deudor')),
  valid_from   date,
  valid_to     date,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (company_id, module, entity_table, entity_id, role)
);
create index if not exists idx_party_links_party on public.party_links(party_id);

-- Normalización de RFC (upper/trim) coherente con nomi_blind_hash.
create or replace function public.accounting_norm_rfc(p_rfc text)
returns text language sql immutable set search_path = pg_catalog, public as $$
  select nullif(upper(regexp_replace(coalesce(p_rfc,''), '\s', '', 'g')), '');
$$;

-- RPC: alta/dedup de party (por RFC, con fallback por nombre; genéricos sin unicidad).
create or replace function public.accounting_upsert_party(
  p_company uuid, p_party_type text, p_display_name text, p_rfc text default null,
  p_legal_name text default null, p_regimen text default null, p_cp text default null, p_source text default 'manual')
returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare v_id uuid; v_rfc text; v_generic boolean;
begin
  if not (public.accounting_can(p_company,'accounting.configure') or public.accounting_can(p_company,'accounting.generate')) then
    raise exception 'FORBIDDEN';
  end if;
  v_rfc := public.accounting_norm_rfc(p_rfc);
  v_generic := v_rfc in ('XAXX010101000','XEXX010101000');
  if v_rfc is not null and not v_generic then
    select id into v_id from public.parties where company_id=p_company and rfc_normalized=v_rfc and status<>'merged' limit 1;
  end if;
  if v_id is null then
    select id into v_id from public.parties
     where company_id=p_company and rfc_normalized is null and lower(display_name)=lower(p_display_name) and status<>'merged' limit 1;
  end if;
  if v_id is not null then return v_id; end if;
  insert into public.parties(company_id, party_type, display_name, legal_name, rfc_normalized, tax_id_last4, regimen_fiscal, codigo_postal, source)
  values (p_company, p_party_type, p_display_name, p_legal_name,
          case when v_generic then null else v_rfc end,
          right(v_rfc,4), p_regimen, p_cp, p_source)
  returning id into v_id;
  perform public.accounting_log_audit(p_company,'contacheck_party', v_id, 'create_party', jsonb_build_object('rfc_last4', right(coalesce(v_rfc,''),4)));
  return v_id;
end $$;

-- RPC: fusión controlada (nunca automática): marca merged + repunta links. Pólizas posted conservan snapshot.
create or replace function public.accounting_merge_party(p_company uuid, p_from uuid, p_into uuid, p_reason text)
returns void language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not public.accounting_can(p_company,'accounting.configure') then raise exception 'FORBIDDEN'; end if;
  if p_from = p_into then raise exception 'MERGE_SAME_PARTY'; end if;
  update public.party_links set party_id = p_into where party_id = p_from and company_id = p_company;
  update public.parties set status='merged', merged_into_party_id=p_into, updated_at=now() where id=p_from and company_id=p_company;
  perform public.accounting_log_audit(p_company,'contacheck_party', p_from, 'merge_party', jsonb_build_object('into',p_into), p_reason);
end $$;

revoke all on function public.accounting_upsert_party(uuid,text,text,text,text,text,text,text) from public, anon;
revoke all on function public.accounting_merge_party(uuid,uuid,uuid,text) from public, anon;
grant execute on function public.accounting_upsert_party(uuid,text,text,text,text,text,text,text) to authenticated, service_role;
grant execute on function public.accounting_merge_party(uuid,uuid,uuid,text) to authenticated, service_role;
grant execute on function public.accounting_norm_rfc(text) to authenticated, service_role;

alter table public.parties     enable row level security;
alter table public.party_links enable row level security;
