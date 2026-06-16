-- Reembolsos son políticas con policy_type='reembolso', no tabla separada.
-- Esta migración es no-op (la tabla reembolsos no existe en el schema final).
SELECT 1;
