-- Seed: crear miembros de equipo de prueba con perfiles y rutas
-- Inserta datos de prueba para rutas_equipo: usuarios, perfiles, company_members, daily_routes.
-- Idempotente: verifica si ya existen antes de insertar.

DO $$
DECLARE
  v_company_id       uuid;
  v_owner_id         uuid;
  v_user1_id         uuid;
  v_user2_id         uuid;
  v_user3_id         uuid;
  v_today            date := CURRENT_DATE;
  v_yesterday        date := CURRENT_DATE - 1;
BEGIN
  -- 1. Obtener la primera empresa activa (o crear una)
  SELECT company_id INTO v_company_id
  FROM company_members
  WHERE status = 'active'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE NOTICE 'Sin empresa activa — omitiendo seed de miembros de equipo';
    RETURN;
  END IF;

  -- 2. Obtener el owner de esa empresa
  SELECT user_id INTO v_owner_id
  FROM company_members
  WHERE company_id = v_company_id AND role IN ('owner', 'admin')
  LIMIT 1;

  IF v_owner_id IS NULL THEN
    RAISE NOTICE 'Sin owner/admin — omitiendo seed de miembros de equipo';
    RETURN;
  END IF;

  -- 3. Crear perfiles de prueba si no existen (en tabla profiles, no en auth.users directamente)
  -- Los UUIDs son ficticios para propósitos de demostración en desarrollo
  v_user1_id := '11111111-1111-1111-1111-111111111111'::uuid;
  v_user2_id := '22222222-2222-2222-2222-222222222222'::uuid;
  v_user3_id := '33333333-3333-3333-3333-333333333333'::uuid;

  -- Insertar perfiles si no existen
  INSERT INTO profiles (id, full_name, avatar_url, created_at)
  VALUES
    (v_user1_id, 'Juan Mensajero', NULL, NOW()),
    (v_user2_id, 'María Operadora', NULL, NOW()),
    (v_user3_id, 'Carlos Distribuidor', NULL, NOW())
  ON CONFLICT (id) DO NOTHING;

  -- 4. Crear company_members si no existen
  INSERT INTO company_members (user_id, company_id, role, status, created_at)
  VALUES
    (v_user1_id, v_company_id, 'spender', 'active', NOW()),
    (v_user2_id, v_company_id, 'operator', 'active', NOW()),
    (v_user3_id, v_company_id, 'employee', 'active', NOW())
  ON CONFLICT (user_id, company_id) DO NOTHING;

  -- 5. Insertar rutas de prueba para hoy
  INSERT INTO daily_routes (user_id, company_id, route_date, points, total_km, updated_at)
  VALUES
    (v_user1_id, v_company_id, v_today,
      jsonb_build_array(
        jsonb_build_object('lat', 19.4326, 'lng', -99.1332, 'ts', v_today || 'T08:00:00Z', 'note', 'Inicio jornada'),
        jsonb_build_object('lat', 19.4380, 'lng', -99.1400, 'ts', v_today || 'T09:30:00Z'),
        jsonb_build_object('lat', 19.4450, 'lng', -99.1480, 'ts', v_today || 'T11:00:00Z', 'note', 'Visita cliente #1'),
        jsonb_build_object('lat', 19.4500, 'lng', -99.1550, 'ts', v_today || 'T13:00:00Z'),
        jsonb_build_object('lat', 19.4420, 'lng', -99.1620, 'ts', v_today || 'T15:30:00Z', 'note', 'Entrega almacén'),
        jsonb_build_object('lat', 19.4326, 'lng', -99.1332, 'ts', v_today || 'T17:00:00Z', 'note', 'Regreso base')
      ),
      12.4,
      NOW()
    ),
    (v_user2_id, v_company_id, v_today,
      jsonb_build_array(
        jsonb_build_object('lat', 19.3500, 'lng', -99.2000, 'ts', v_today || 'T07:00:00Z', 'note', 'Zona sur'),
        jsonb_build_object('lat', 19.3600, 'lng', -99.2100, 'ts', v_today || 'T08:45:00Z'),
        jsonb_build_object('lat', 19.3700, 'lng', -99.2200, 'ts', v_today || 'T10:30:00Z', 'note', 'Recogida paquete'),
        jsonb_build_object('lat', 19.3500, 'lng', -99.2000, 'ts', v_today || 'T12:00:00Z')
      ),
      8.3,
      NOW()
    ),
    (v_user3_id, v_company_id, v_today,
      jsonb_build_array(
        jsonb_build_object('lat', 19.5000, 'lng', -99.0500, 'ts', v_today || 'T09:00:00Z', 'note', 'Zona oriente'),
        jsonb_build_object('lat', 19.5100, 'lng', -99.0600, 'ts', v_today || 'T11:00:00Z', 'note', 'Cliente corporativo'),
        jsonb_build_object('lat', 19.5200, 'lng', -99.0700, 'ts', v_today || 'T14:30:00Z', 'note', 'Entrega documentos'),
        jsonb_build_object('lat', 19.5000, 'lng', -99.0500, 'ts', v_today || 'T16:00:00Z')
      ),
      15.6,
      NOW()
    )
  ON CONFLICT (user_id, route_date) DO NOTHING;

  -- 6. Insertar rutas de prueba para ayer
  INSERT INTO daily_routes (user_id, company_id, route_date, points, total_km, updated_at)
  VALUES
    (v_user1_id, v_company_id, v_yesterday,
      jsonb_build_array(
        jsonb_build_object('lat', 19.4326, 'lng', -99.1332, 'ts', v_yesterday || 'T07:45:00Z', 'note', 'Salida'),
        jsonb_build_object('lat', 19.4600, 'lng', -99.1700, 'ts', v_yesterday || 'T10:00:00Z', 'note', 'Cliente zona norte'),
        jsonb_build_object('lat', 19.4326, 'lng', -99.1332, 'ts', v_yesterday || 'T16:00:00Z', 'note', 'Fin jornada')
      ),
      18.7,
      NOW()
    ),
    (v_user2_id, v_company_id, v_yesterday,
      jsonb_build_array(
        jsonb_build_object('lat', 19.3500, 'lng', -99.2000, 'ts', v_yesterday || 'T08:00:00Z'),
        jsonb_build_object('lat', 19.3800, 'lng', -99.2300, 'ts', v_yesterday || 'T12:00:00Z'),
        jsonb_build_object('lat', 19.3500, 'lng', -99.2000, 'ts', v_yesterday || 'T17:00:00Z')
      ),
      14.2,
      NOW()
    ),
    (v_user3_id, v_company_id, v_yesterday,
      jsonb_build_array(
        jsonb_build_object('lat', 19.5000, 'lng', -99.0500, 'ts', v_yesterday || 'T09:30:00Z'),
        jsonb_build_object('lat', 19.5300, 'lng', -99.0800, 'ts', v_yesterday || 'T13:00:00Z'),
        jsonb_build_object('lat', 19.5000, 'lng', -99.0500, 'ts', v_yesterday || 'T17:30:00Z')
      ),
      12.1,
      NOW()
    )
  ON CONFLICT (user_id, route_date) DO NOTHING;

  RAISE NOTICE 'Miembros de equipo y rutas de prueba insertados para empresa %', v_company_id;
END $$;
