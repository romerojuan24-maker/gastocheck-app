-- ============================================================================
-- VALIDACIÓN POST-MIGRACIÓN — GastoCheck v1.0
-- Ejecuta este script para verificar que todo se creó correctamente
-- ============================================================================

-- 1. VERIFICAR TABLAS CREADAS
-- ============================================================================
SELECT
  'TABLAS CREADAS' as categoria,
  table_name,
  'OK' as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('viaticos', 'contador_general_assignments')
ORDER BY table_name;

-- 2. VERIFICAR COLUMNAS EN EXPENSES
-- ============================================================================
SELECT
  'COLUMNAS AGREGADAS A EXPENSES' as categoria,
  column_name,
  data_type,
  'OK' as status
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'expenses'
AND column_name IN ('created_by', 'updated_by')
ORDER BY column_name;

-- 3. VERIFICAR ESTRUCTURA DE TABLA VIATICOS
-- ============================================================================
SELECT
  'ESTRUCTURA VIATICOS' as categoria,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'viaticos'
ORDER BY ordinal_position;

-- 4. VERIFICAR ESTRUCTURA DE TABLA CONTADOR_GENERAL_ASSIGNMENTS
-- ============================================================================
SELECT
  'ESTRUCTURA CONTADOR_ASSIGNMENTS' as categoria,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'contador_general_assignments'
ORDER BY ordinal_position;

-- 5. VERIFICAR VISTAS CREADAS
-- ============================================================================
SELECT
  'VISTAS CREADAS' as categoria,
  table_name as view_name,
  'OK' as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'VIEW'
AND table_name IN ('expenses_by_buyer', 'viaticos_by_person', 'executive_summary_daily')
ORDER BY table_name;

-- 6. VERIFICAR ÍNDICES CREADOS
-- ============================================================================
SELECT
  'ÍNDICES CREADOS' as categoria,
  indexname,
  tablename,
  'OK' as status
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('viaticos', 'contador_general_assignments', 'expenses')
AND indexname LIKE '%idx_%'
ORDER BY tablename, indexname;

-- 7. VERIFICAR RLS POLICIES
-- ============================================================================
SELECT
  'RLS POLICIES' as categoria,
  schemaname,
  tablename,
  policyname,
  'OK' as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('viaticos', 'contador_general_assignments', 'expenses')
ORDER BY tablename, policyname;

-- 8. VERIFICAR TRIGGERS
-- ============================================================================
SELECT
  'TRIGGERS' as categoria,
  trigger_name,
  event_object_table,
  action_statement,
  'OK' as status
FROM information_schema.triggers
WHERE trigger_schema = 'public'
AND event_object_table IN ('viaticos')
ORDER BY event_object_table, trigger_name;

-- 9. VERIFICAR CONSTRAINTS EN VIATICOS
-- ============================================================================
SELECT
  'CONSTRAINTS VIATICOS' as categoria,
  constraint_name,
  constraint_type,
  'OK' as status
FROM information_schema.table_constraints
WHERE table_schema = 'public'
AND table_name = 'viaticos'
ORDER BY constraint_name;

-- 10. RESUMEN FINAL — Cuenta de registros en tablas nuevas
-- ============================================================================
SELECT
  'REGISTROS' as categoria,
  'viaticos' as tabla,
  COUNT(*) as total_registros
FROM viaticos
UNION ALL
SELECT
  'REGISTROS' as categoria,
  'contador_general_assignments' as tabla,
  COUNT(*) as total_registros
FROM contador_general_assignments;

-- ============================================================================
-- FIN DE VALIDACIÓN
-- ============================================================================
-- Si ves OK en todas las secciones arriba, la migración fue EXITOSA ✅
