-- Aditivo y seguro: ALTER TYPE ... ADD VALUE no afecta filas existentes.
-- Habilita el rol "Contador General" mencionado desde antes como nivel
-- futuro para empresas grandes; ahora se conecta al flujo real de
-- invitación en la pantalla unificada de Equipo.
ALTER TYPE member_role ADD VALUE IF NOT EXISTS 'contador_general';
