-- ============================================================================
-- Elimina contador_general_assignments: tabla duplicada, huérfana, 0 filas.
-- ============================================================================
-- Historial: se creó en 20260627000000_perfilamiento_gastocheck_v1.sql y se
-- volvió a crear (con el nombre correcto) como accountant_assignments en
-- 20260629030003_gastocheck_v1_corrected.sql. Ninguna de las dos tablas tiene
-- código que las use — la asignación de "Admin y Contador" que ve el usuario
-- en /administracion se lee directo de company_members (OTA 150). Se conserva
-- accountant_assignments (nombre canónico, con RLS ya definido) por si en el
-- futuro se construye la asignación de un contador externo a múltiples
-- empresas; se elimina el duplicado para no dejar ambigüedad.
-- ============================================================================

DROP TABLE IF EXISTS contador_general_assignments;
