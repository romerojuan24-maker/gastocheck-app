-- RESOLUCIÓN: Conflicto de daily_routes
-- Problema: 3 dominios incompatibles (GPS tracking, cobranza, viáticos) usaban la misma tabla
-- Solución: Separar en tablas específicas por dominio
-- Fecha: 2026-07-04

-- ============================================================================
-- PARTE 1: Mantener daily_routes para GPS Tracking (sin cambios)
-- ============================================================================
-- daily_routes ya existe y funciona para GPS tracking de mensajeros/compradores
-- Solo actualizamos comentarios para claridad

COMMENT ON TABLE daily_routes IS 'GPS tracking de rutas diarias — solo para mensajeros/compradores que capturan puntos en campo';
COMMENT ON COLUMN daily_routes.points IS 'Array de puntos GPS: [{lat: number, lng: number, ts: ISO8601 timestamp, note?: string}]';

-- ============================================================================
-- PARTE 2: Crear cobra_routes para Cobranza (nuevo dominio)
-- ============================================================================

CREATE TABLE IF NOT EXISTS cobra_routes (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            uuid        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  actor_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_type            TEXT        NOT NULL DEFAULT 'cobrador' CHECK (actor_type IN ('cobrador', 'comprador')),
  assigned_date         date        NOT NULL,

  -- Orden de visitas
  clients_assigned      uuid[]      NOT NULL DEFAULT '{}',  -- Array de cobra_clients.id

  -- Estado de la ruta
  status                TEXT        NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  route_priority        TEXT        NOT NULL DEFAULT 'media'
                        CHECK (route_priority IN ('baja', 'media', 'alta', 'crítica')),

  -- Estadísticas
  total_distance_km     numeric(10,2),
  estimated_duration_hours numeric(5,2),
  actual_duration_minutes numeric(5,2),

  -- Resultados
  clients_visited       int         DEFAULT 0,
  payments_collected    numeric(12,2) DEFAULT 0,
  promises_made         int         DEFAULT 0,
  rejections            int         DEFAULT 0,

  -- Auditoría
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,

  UNIQUE (actor_id, assigned_date),
  CONSTRAINT valid_clients_array CHECK (array_length(clients_assigned, 1) IS NULL OR array_length(clients_assigned, 1) >= 0)
);

CREATE INDEX idx_cobra_routes_company_date    ON cobra_routes(company_id, assigned_date DESC);
CREATE INDEX idx_cobra_routes_actor_date      ON cobra_routes(actor_id, assigned_date DESC);
CREATE INDEX idx_cobra_routes_status          ON cobra_routes(company_id, status);
CREATE INDEX idx_cobra_routes_priority        ON cobra_routes(company_id, route_priority);

-- Trigger para updated_at
CREATE TRIGGER trg_cobra_routes_touch
  BEFORE UPDATE ON cobra_routes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- PARTE 3: RLS Policies para cobra_routes
-- ============================================================================

ALTER TABLE cobra_routes ENABLE ROW LEVEL SECURITY;

-- SELECT: El cobrador ve su propia ruta, supervisores ven todas
CREATE POLICY "cobra_routes_select" ON cobra_routes FOR SELECT
  USING (
    actor_id = auth.uid()
    OR auth_role(company_id) IN ('owner', 'admin', 'supervisor', 'superadmin')
  );

-- INSERT: Solo supervisores/admin pueden crear rutas (no el cobrador)
CREATE POLICY "cobra_routes_insert" ON cobra_routes FOR INSERT
  WITH CHECK (
    auth_role(company_id) IN ('owner', 'admin', 'supervisor', 'superadmin')
  );

-- UPDATE: El cobrador puede actualizar su propia ruta (status, estadísticas),
--         supervisores/admin pueden actualizar cualquiera
CREATE POLICY "cobra_routes_update" ON cobra_routes FOR UPDATE
  USING (
    actor_id = auth.uid()
    OR auth_role(company_id) IN ('owner', 'admin', 'supervisor', 'superadmin')
  )
  WITH CHECK (
    actor_id = auth.uid()
    OR auth_role(company_id) IN ('owner', 'admin', 'supervisor', 'superadmin')
  );

-- DELETE: Solo admin/owner pueden borrar
CREATE POLICY "cobra_routes_delete" ON cobra_routes FOR DELETE
  USING (
    auth_role(company_id) IN ('owner', 'admin', 'superadmin')
  );

-- ============================================================================
-- PARTE 4: Vínculo entre cobra_routes y cobra_movements
-- ============================================================================

-- Agregar columna route_id a cobra_movements para vincular a cobra_routes
ALTER TABLE cobra_movements
  ADD COLUMN route_id uuid REFERENCES cobra_routes(id) ON DELETE SET NULL;

CREATE INDEX idx_cobra_movements_route ON cobra_movements(route_id);

-- ============================================================================
-- PARTE 5: Vista agregada para Dashboard de Cobranza
-- ============================================================================

CREATE OR REPLACE VIEW cobra_routes_summary AS
SELECT
  cr.id,
  cr.company_id,
  cr.actor_id,
  cr.assigned_date,
  cr.status,
  cr.route_priority,
  cr.clients_assigned,
  cr.clients_visited,
  cr.total_distance_km,
  cr.estimated_duration_hours,
  cr.actual_duration_minutes,
  cr.payments_collected,
  cr.promises_made,
  cr.rejections,
  array_length(cr.clients_assigned, 1) as total_clients_assigned,
  CASE
    WHEN cr.status = 'completed' AND cr.clients_visited > 0
    THEN ROUND((cr.clients_visited::numeric / array_length(cr.clients_assigned, 1) * 100), 2)
    ELSE 0
  END as completion_percentage,
  cr.created_at,
  cr.updated_at,
  cr.completed_at
FROM cobra_routes cr
WHERE array_length(cr.clients_assigned, 1) > 0;

-- RLS para vista
ALTER VIEW cobra_routes_summary OWNER TO authenticated;

-- ============================================================================
-- PARTE 6: Comentarios de Resolución
-- ============================================================================

COMMENT ON TABLE cobra_routes IS 'Rutas de cobranza — planificación de visitas a clientes para cobro. SEPARADO de daily_routes (GPS tracking)';
COMMENT ON TABLE daily_routes IS 'GPS tracking de rutas diarias — solo para mensajeros/compradores sin lógica de cobranza';
COMMENT ON COLUMN cobra_routes.actor_type IS 'Tipo de actor: cobrador (cobranza) o comprador (entregas). Define negocio del actor';
COMMENT ON COLUMN cobra_routes.clients_assigned IS 'Array ordenado de IDs de cobra_clients a visitar. Orden es prioridad de visita';
COMMENT ON COLUMN cobra_routes.status IS 'Estado: planned → in_progress → completed | cancelled';

-- ============================================================================
-- PARTE 7: Verificaciones de Integridad
-- ============================================================================

-- Verificar que todas las tablas cobra_* están en mismo schema
DO $$
DECLARE
  missing_tables TEXT;
BEGIN
  missing_tables := (
    SELECT STRING_AGG(table_name, ', ')
    FROM (
      VALUES
        ('cobra_clients'),
        ('cobra_invoices'),
        ('cobra_payments'),
        ('cobra_promises'),
        ('cobra_calls'),
        ('cobra_movements'),
        ('cobra_reminders'),
        ('cobra_routes')
    ) AS t(table_name)
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t.table_name
    )
  );

  IF missing_tables IS NOT NULL THEN
    RAISE WARNING 'COBRACHECK: Tablas faltantes: %', missing_tables;
  ELSE
    RAISE NOTICE 'COBRACHECK: Todas las tablas cobra_* existen ✓';
  END IF;
END;
$$;

-- ============================================================================
-- RESUMEN DE CAMBIOS
-- ============================================================================

/*
ANTES (Conflicto):
  - daily_routes usada por GPS tracking, cobranza y viáticos simultáneamente
  - Tipos TypeScript no coincidían con SQL
  - Imposible implementar lógica de cobranza sin romper GPS tracking

DESPUÉS (Resuelto):
  ✓ daily_routes: SOLO GPS tracking (user_id, points[], route_date)
  ✓ cobra_routes: SOLO cobranza (actor_id, clients_assigned[], status)
  ✓ Ambas tablas con RLS y indexación específica
  ✓ Separación clara de dominios
  ✓ Vista agregada cobra_routes_summary para dashboard

PRÓXIMOS PASOS:
  1. Actualizar tipos TypeScript en packages/shared/src/types/
  2. Crear API endpoints /api/cobra/routes/*
  3. Actualizar componentes para usar cobra_routes
  4. Ejecutar migración en Supabase production
  5. Tests de integración
*/
