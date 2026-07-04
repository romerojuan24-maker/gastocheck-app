-- VALIDACIÓN COMPLETA — Todo en un solo SELECT
SELECT categoria, objeto, status FROM (

  -- TABLAS
  SELECT 'TABLA' as categoria, 'viaticos' as objeto,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='viaticos')
    THEN '✅ EXISTE' ELSE '❌ FALTA' END as status

  UNION ALL SELECT 'TABLA', 'contador_general_assignments',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='contador_general_assignments')
    THEN '✅ EXISTE' ELSE '❌ FALTA' END

  -- COLUMNAS EN EXPENSES
  UNION ALL SELECT 'COLUMNA', 'expenses.created_by',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='created_by')
    THEN '✅ EXISTE' ELSE '❌ FALTA' END

  UNION ALL SELECT 'COLUMNA', 'expenses.updated_by',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='expenses' AND column_name='updated_by')
    THEN '✅ EXISTE' ELSE '❌ FALTA' END

  -- VISTAS
  UNION ALL SELECT 'VISTA', 'expenses_by_buyer',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='expenses_by_buyer')
    THEN '✅ EXISTE' ELSE '❌ FALTA' END

  UNION ALL SELECT 'VISTA', 'viaticos_by_person',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='viaticos_by_person')
    THEN '✅ EXISTE' ELSE '❌ FALTA' END

  UNION ALL SELECT 'VISTA', 'executive_summary_daily',
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='executive_summary_daily')
    THEN '✅ EXISTE' ELSE '❌ FALTA' END

  -- RLS HABILITADO
  UNION ALL SELECT 'RLS', 'viaticos',
    CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE relname='viaticos' AND relnamespace='public'::regnamespace)
    THEN '✅ HABILITADO' ELSE '❌ DESHABILITADO' END

  UNION ALL SELECT 'RLS', 'contador_general_assignments',
    CASE WHEN (SELECT relrowsecurity FROM pg_class WHERE relname='contador_general_assignments' AND relnamespace='public'::regnamespace)
    THEN '✅ HABILITADO' ELSE '❌ DESHABILITADO' END

  -- POLICIES
  UNION ALL SELECT 'POLICY', policyname,
    '✅ EXISTE'
  FROM pg_policies
  WHERE schemaname='public'
  AND tablename IN ('viaticos', 'contador_general_assignments', 'expenses')

  -- TRIGGER
  UNION ALL SELECT 'TRIGGER', trigger_name,
    '✅ EXISTE'
  FROM information_schema.triggers
  WHERE trigger_schema='public' AND event_object_table='viaticos'

) resultado
ORDER BY categoria, objeto;
