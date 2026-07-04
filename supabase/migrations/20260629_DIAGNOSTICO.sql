-- DIAGNÓSTICO: ¿QUÉ SE CREÓ Y QUÉ NO?

-- 1. ¿Existe tabla VIATICOS?
SELECT
  'viaticos' as tabla,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'viaticos'
  ) THEN 'EXISTE ✅' ELSE 'NO EXISTE ❌' END as status;

-- 2. ¿Existe tabla CONTADOR_GENERAL_ASSIGNMENTS?
SELECT
  'contador_general_assignments' as tabla,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'contador_general_assignments'
  ) THEN 'EXISTE ✅' ELSE 'NO EXISTE ❌' END as status;

-- 3. ¿Existen columnas en EXPENSES?
SELECT
  'expenses.created_by' as columna,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'created_by'
  ) THEN 'EXISTE ✅' ELSE 'NO EXISTE ❌' END as status
UNION ALL
SELECT
  'expenses.updated_by' as columna,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'expenses' AND column_name = 'updated_by'
  ) THEN 'EXISTE ✅' ELSE 'NO EXISTE ❌' END as status;

-- 4. ¿Existen las vistas?
SELECT
  'expenses_by_buyer' as vista,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'expenses_by_buyer' AND table_type = 'VIEW'
  ) THEN 'EXISTE ✅' ELSE 'NO EXISTE ❌' END as status
UNION ALL
SELECT
  'viaticos_by_person' as vista,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'viaticos_by_person' AND table_type = 'VIEW'
  ) THEN 'EXISTE ✅' ELSE 'NO EXISTE ❌' END as status
UNION ALL
SELECT
  'executive_summary_daily' as vista,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'executive_summary_daily' AND table_type = 'VIEW'
  ) THEN 'EXISTE ✅' ELSE 'NO EXISTE ❌' END as status;

-- 5. Listar TODAS las tablas nuevas que empiezan con 'viatico' o 'contador'
SELECT 'TABLAS ENCONTRADAS' as tipo, table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name LIKE '%viatico%' OR table_name LIKE '%contador%')
ORDER BY table_name;
