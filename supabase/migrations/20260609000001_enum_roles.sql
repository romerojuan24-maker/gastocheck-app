-- ============================================================================
-- GastoCheck — Migration 0005: Agregar roles al enum member_role
--
-- IMPORTANTE: Ejecutar este script PRIMERO, ANTES que 000003_receipts_schema.sql
--
-- Por qué está separado:
--   PostgreSQL no permite usar valores de enum recién creados dentro de la
--   misma transacción que los define (error: "unsafe use of new value of enum").
--   Al ejecutar este script solo, hace commit automáticamente y los valores
--   quedan disponibles para la siguiente query.
-- ============================================================================

ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'operator'   AFTER 'spender';
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'admin'      AFTER 'office';
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'superadmin' AFTER 'admin';
