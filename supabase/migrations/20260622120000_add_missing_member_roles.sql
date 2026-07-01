-- El código de la app (permissions.ts, invite/route.ts, CobraCheck) asume los roles
-- 'buyer', 'viewer' y 'collector' pero el enum member_role nunca los tuvo — solo
-- tenía 'cobrador' (no 'collector'). Sin esto, invitar con esos roles falla en la BD.
-- Aditivo y seguro: ALTER TYPE ... ADD VALUE no afecta filas existentes.

ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'buyer';
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'viewer';
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'collector';
