-- Seed: datos de prueba para daily_routes (rutas del equipo)
-- Inserta rutas simuladas para HOY usando los primeros 3 miembros activos de la primera empresa.
-- Seguro: ON CONFLICT DO NOTHING — no sobreescribe datos reales.

DO $$
DECLARE
  v_company_id uuid;
  v_user_id    uuid;
  v_today      date := CURRENT_DATE;
  v_yday       date := CURRENT_DATE - 1;
BEGIN
  SELECT company_id INTO v_company_id
  FROM company_members
  WHERE status = 'active'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RAISE NOTICE 'Sin empresa activa — omitiendo seed de rutas';
    RETURN;
  END IF;

  FOR v_user_id IN
    SELECT user_id FROM company_members
    WHERE company_id = v_company_id AND status = 'active'
    ORDER BY created_at
    LIMIT 3
  LOOP
    -- Ruta de hoy
    INSERT INTO daily_routes (user_id, company_id, route_date, points, total_km)
    VALUES (
      v_user_id,
      v_company_id,
      v_today,
      jsonb_build_array(
        jsonb_build_object('lat', 19.4326, 'lng', -99.1332, 'ts', v_today || 'T08:00:00Z', 'note', 'Inicio jornada'),
        jsonb_build_object('lat', 19.4380, 'lng', -99.1400, 'ts', v_today || 'T09:30:00Z'),
        jsonb_build_object('lat', 19.4450, 'lng', -99.1480, 'ts', v_today || 'T11:00:00Z', 'note', 'Visita cliente #1'),
        jsonb_build_object('lat', 19.4500, 'lng', -99.1550, 'ts', v_today || 'T13:00:00Z'),
        jsonb_build_object('lat', 19.4420, 'lng', -99.1620, 'ts', v_today || 'T15:30:00Z', 'note', 'Entrega almacén'),
        jsonb_build_object('lat', 19.4326, 'lng', -99.1332, 'ts', v_today || 'T17:00:00Z', 'note', 'Regreso base')
      ),
      12.4
    )
    ON CONFLICT (user_id, route_date) DO NOTHING;

    -- Ruta de ayer
    INSERT INTO daily_routes (user_id, company_id, route_date, points, total_km)
    VALUES (
      v_user_id,
      v_company_id,
      v_yday,
      jsonb_build_array(
        jsonb_build_object('lat', 19.4326, 'lng', -99.1332, 'ts', v_yday || 'T07:45:00Z', 'note', 'Salida temprana'),
        jsonb_build_object('lat', 19.4600, 'lng', -99.1700, 'ts', v_yday || 'T10:00:00Z', 'note', 'Cliente zona norte'),
        jsonb_build_object('lat', 19.4326, 'lng', -99.1332, 'ts', v_yday || 'T16:00:00Z', 'note', 'Fin jornada')
      ),
      18.7
    )
    ON CONFLICT (user_id, route_date) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Mock routes insertadas para empresa %', v_company_id;
END $$;
