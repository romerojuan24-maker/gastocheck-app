-- BancoCheck NUNCA almacena credenciales bancarias (regla explícita del
-- módulo). bank_accounts_automated guardaba oauth_token_encrypted /
-- oauth_refresh_token para una sincronización OAuth (BBVA/Santander/Belvo)
-- que nunca se conectó a ninguna pantalla real — código muerto encontrado
-- y confirmado sin filas (tabla vacía) antes de eliminarla.
drop table if exists bank_accounts_automated;
