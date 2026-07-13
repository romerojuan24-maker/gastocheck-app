-- FacturaCheck — lo "normal" que le falta a un CFDI 4.0 completo:
-- catálogo de clientes, catálogo de productos/servicios, y la relación
-- entre CFDIs (nota de crédito / complemento de pago referencian el
-- UUID del comprobante original — obligatorio en CFDI 4.0).

alter table cfdi_issue_requests
  add column if not exists related_uuid_cfdi text,      -- UUID del CFDI que se relaciona (nota crédito / REP)
  add column if not exists relacion_tipo     text;       -- catálogo SAT c_TipoRelacion: 01,02,03,04...

comment on column cfdi_issue_requests.related_uuid_cfdi is
  'CFDI 4.0 exige CfdiRelacionados con el UUID original en notas de crédito (egreso) y complementos de pago.';

create table if not exists cfdi_clients (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  rfc             text not null,
  razon_social    text,
  uso_cfdi        text not null default 'G03',
  regimen_fiscal  text,
  codigo_postal   text,
  email           text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (company_id, rfc)
);

create table if not exists cfdi_products (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references companies(id) on delete cascade,
  descripcion     text not null,
  clave_prod_serv text not null default '01010101',  -- catálogo SAT c_ClaveProdServ
  clave_unidad    text not null default 'H87',        -- catálogo SAT c_ClaveUnidad
  precio_default  numeric(15,2),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_cfdi_clients_company on cfdi_clients(company_id);
create index if not exists idx_cfdi_products_company on cfdi_products(company_id);

alter table cfdi_clients  enable row level security;
alter table cfdi_products enable row level security;

-- Mismos roles que ya pueden emitir/gestionar cfdi_issue_requests.
drop policy if exists "member_manage_cfdi_clients" on cfdi_clients;
create policy "member_manage_cfdi_clients" on cfdi_clients for all using (
  exists (
    select 1 from company_members m
    where m.company_id = cfdi_clients.company_id and m.user_id = auth.uid() and m.status = 'active'
      and m.role in ('owner','admin','supervisor','accountant','contador_general')
  )
);

drop policy if exists "member_manage_cfdi_products" on cfdi_products;
create policy "member_manage_cfdi_products" on cfdi_products for all using (
  exists (
    select 1 from company_members m
    where m.company_id = cfdi_products.company_id and m.user_id = auth.uid() and m.status = 'active'
      and m.role in ('owner','admin','supervisor','accountant','contador_general')
  )
);
