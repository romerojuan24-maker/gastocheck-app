-- ============================================================================
-- CobraCheck — Paso 1: agregar rol 'cobrador' al enum member_role
--
-- DEBE ejecutarse ANTES de 20260618200001_cobra_check_tables.sql
-- Por qué está separado: PostgreSQL no permite usar valores de enum recién
-- creados dentro de la misma transacción que los define (SQLSTATE 55P04).
-- Al ejecutar este script solo, hace commit y el valor queda disponible.
-- ============================================================================

ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'cobrador' AFTER 'operator';
