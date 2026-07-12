-- InventarioCheck — Wave 1: RPCs ACID para movimientos. Estas son las
-- ÚNICAS funciones que pueden tocar inventory_stock — todo pasa por aquí:
-- validar tenant → validar producto/ubicación → validar existencia si es
-- salida → actualizar stock → crear movimiento → audit log, todo en UNA
-- transacción de Postgres (una función = una transacción real).

create or replace function inventory_get_or_create_default_location(p_company_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from inventory_locations
  where company_id = p_company_id and name = 'Almacén General' limit 1;
  if v_id is not null then return v_id; end if;

  insert into inventory_locations (company_id, name, type)
  values (p_company_id, 'Almacén General', 'warehouse')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function inventory_quick_movement(
  p_product_id       uuid,
  p_movement_type    text,   -- IN | OUT | ADJUSTMENT_IN | ADJUSTMENT_OUT | WASTE | RETURN_IN | RETURN_OUT
  p_quantity         numeric,
  p_reason           text default null,
  p_notes            text default null,
  p_location_id      uuid default null,
  p_idempotency_key  text default null
) returns inventory_movements
language plpgsql security definer set search_path = public as $$
declare
  v_company_id      uuid;
  v_location_id     uuid;
  v_stock_row       inventory_stock;
  v_existing        inventory_movements;
  v_movement        inventory_movements;
  v_stock_before    numeric;
  v_stock_after     numeric;
  v_allow_negative  boolean;
  v_delta           numeric;
  v_new_qty         numeric;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;
  if p_movement_type not in ('IN','OUT','ADJUSTMENT_IN','ADJUSTMENT_OUT','WASTE','RETURN_IN','RETURN_OUT') then
    raise exception 'Tipo de movimiento inválido: %', p_movement_type;
  end if;

  select company_id into v_company_id from inventory_products where id = p_product_id;
  if v_company_id is null then
    raise exception 'Producto no encontrado';
  end if;

  if not exists (
    select 1 from company_members
    where company_id = v_company_id and user_id = auth.uid() and status = 'active'
      and role in ('owner','admin','supervisor','operator','accountant','contador_general')
  ) then
    raise exception 'Sin permiso para registrar movimientos de inventario';
  end if;

  -- Idempotencia: mismo idempotency_key = mismo resultado, no duplicar.
  if p_idempotency_key is not null then
    select * into v_existing from inventory_movements
    where company_id = v_company_id and idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  v_location_id := coalesce(p_location_id, inventory_get_or_create_default_location(v_company_id));

  select coalesce(allow_negative_inventory, false) into v_allow_negative
  from companies where id = v_company_id;

  v_delta := case when p_movement_type in ('IN','ADJUSTMENT_IN','RETURN_IN') then p_quantity else -p_quantity end;

  -- Bloquea la fila de stock de esta ubicación (evita condición de carrera
  -- con otro movimiento simultáneo del mismo producto/ubicación).
  select * into v_stock_row from inventory_stock
  where product_id = p_product_id and location_id = v_location_id
  for update;

  if not found then
    insert into inventory_stock (company_id, product_id, location_id, quantity)
    values (v_company_id, p_product_id, v_location_id, 0)
    returning * into v_stock_row;
  end if;

  v_new_qty := v_stock_row.quantity + v_delta;
  if v_new_qty < 0 and not v_allow_negative then
    raise exception 'Stock insuficiente en esta ubicación (disponible: %, solicitado: %)', v_stock_row.quantity, p_quantity;
  end if;

  update inventory_stock set quantity = v_new_qty, updated_at = now()
  where id = v_stock_row.id;

  select stock_current into v_stock_before from inventory_products where id = p_product_id;
  v_stock_after := v_stock_before + v_delta;
  if v_stock_after < 0 and not v_allow_negative then
    raise exception 'Stock insuficiente (disponible: %, solicitado: %)', v_stock_before, p_quantity;
  end if;

  update inventory_products set stock_current = v_stock_after, updated_at = now()
  where id = p_product_id;

  insert into inventory_movements (
    company_id, product_id, movement_type, quantity, stock_before, stock_after,
    notes, source, location_id, reason, idempotency_key, created_by
  ) values (
    v_company_id, p_product_id, p_movement_type, p_quantity, v_stock_before, v_stock_after,
    p_notes, 'manual', v_location_id, p_reason, p_idempotency_key, auth.uid()
  ) returning * into v_movement;

  insert into audit_logs (company_id, user_id, entity_type, entity_id, action, new_values)
  values (v_company_id, auth.uid(), 'inventory_movement', v_movement.id, p_movement_type,
    jsonb_build_object('product_id', p_product_id, 'quantity', p_quantity, 'reason', p_reason));

  return v_movement;
end;
$$;

create or replace function inventory_transfer(
  p_product_id       uuid,
  p_from_location_id uuid,
  p_to_location_id   uuid,
  p_quantity         numeric,
  p_notes            text default null,
  p_idempotency_key  text default null
) returns inventory_movements
language plpgsql security definer set search_path = public as $$
declare
  v_company_id     uuid;
  v_existing       inventory_movements;
  v_movement       inventory_movements;
  v_from_row       inventory_stock;
  v_allow_negative boolean;
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero';
  end if;
  if p_from_location_id = p_to_location_id then
    raise exception 'La ubicación de origen y destino no pueden ser la misma';
  end if;

  select company_id into v_company_id from inventory_products where id = p_product_id;
  if v_company_id is null then raise exception 'Producto no encontrado'; end if;

  if not exists (
    select 1 from company_members
    where company_id = v_company_id and user_id = auth.uid() and status = 'active'
      and role in ('owner','admin','supervisor','operator','accountant','contador_general')
  ) then
    raise exception 'Sin permiso para mover inventario';
  end if;

  if not exists (select 1 from inventory_locations where id = p_from_location_id and company_id = v_company_id)
     or not exists (select 1 from inventory_locations where id = p_to_location_id and company_id = v_company_id) then
    raise exception 'Ubicación inválida para esta empresa';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from inventory_movements
    where company_id = v_company_id and idempotency_key = p_idempotency_key;
    if found then return v_existing; end if;
  end if;

  select coalesce(allow_negative_inventory, false) into v_allow_negative from companies where id = v_company_id;

  select * into v_from_row from inventory_stock
  where product_id = p_product_id and location_id = p_from_location_id
  for update;

  if not found or (v_from_row.quantity - p_quantity < 0 and not v_allow_negative) then
    raise exception 'Stock insuficiente en la ubicación de origen';
  end if;

  update inventory_stock set quantity = quantity - p_quantity, updated_at = now()
  where id = v_from_row.id;

  insert into inventory_stock (company_id, product_id, location_id, quantity)
  values (v_company_id, p_product_id, p_to_location_id, p_quantity)
  on conflict (company_id, product_id, location_id)
  do update set quantity = inventory_stock.quantity + p_quantity, updated_at = now();

  insert into inventory_movements (
    company_id, product_id, movement_type, quantity, stock_before, stock_after,
    notes, source, location_id, to_location_id, idempotency_key, created_by
  )
  select v_company_id, p_product_id, 'TRANSFER', p_quantity, stock_current, stock_current, -- total global no cambia
    p_notes, 'manual', p_from_location_id, p_to_location_id, p_idempotency_key, auth.uid()
  from inventory_products where id = p_product_id
  returning * into v_movement;

  insert into audit_logs (company_id, user_id, entity_type, entity_id, action, new_values)
  values (v_company_id, auth.uid(), 'inventory_movement', v_movement.id, 'TRANSFER',
    jsonb_build_object('product_id', p_product_id, 'quantity', p_quantity, 'from', p_from_location_id, 'to', p_to_location_id));

  return v_movement;
end;
$$;

grant execute on function inventory_get_or_create_default_location(uuid) to authenticated;
grant execute on function inventory_quick_movement(uuid, text, numeric, text, text, uuid, text) to authenticated;
grant execute on function inventory_transfer(uuid, uuid, uuid, numeric, text, text) to authenticated;
