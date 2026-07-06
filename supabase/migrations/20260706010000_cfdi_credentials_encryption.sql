-- ============================================================================
-- Cifrado real de credenciales PAC (cfdi_provider_configs.pac_user_enc /
-- pac_pass_enc). Antes se guardaban y leían en texto plano pese al sufijo
-- "_enc". La llave de cifrado NUNCA vive en la base de datos: se pasa como
-- parámetro desde las Edge Functions, que la leen de su propio secreto de
-- entorno (CFDI_ENC_KEY, ya configurado vía `supabase secrets set`).
-- ============================================================================

CREATE OR REPLACE FUNCTION pgp_encrypt_secret(plain text, enc_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN plain IS NULL OR plain = '' THEN NULL
         ELSE encode(pgp_sym_encrypt(plain, enc_key), 'base64')
         END;
$$;

CREATE OR REPLACE FUNCTION pgp_decrypt_secret(enc text, enc_key text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN enc IS NULL OR enc = '' THEN NULL
         ELSE pgp_sym_decrypt(decode(enc, 'base64'), enc_key)
         END;
$$;

-- Solo service_role (usado por Edge Functions) puede invocar estas funciones.
-- Un usuario autenticado normal no debe poder intentar fuerza bruta sobre
-- el cifrado vía RPC directo, aunque de cualquier forma no conoce la llave.
REVOKE EXECUTE ON FUNCTION pgp_encrypt_secret(text, text) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION pgp_decrypt_secret(text, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION pgp_encrypt_secret(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION pgp_decrypt_secret(text, text) TO service_role;

-- Defensa en profundidad: ni siquiera owner/admin pueden escribir estas
-- columnas directamente desde el cliente (RLS es por fila, no por columna).
-- Todo el guardado de credenciales debe pasar por la Edge Function
-- pac-config-set, que cifra antes de escribir usando service_role.
--
-- NOTA: un REVOKE column-level simple sobre un GRANT ALL de tabla no
-- siempre queda reflejado de forma confiable (verificado con
-- information_schema.column_privileges) — se usa en su lugar un allowlist
-- explícito: se revoca UPDATE/INSERT completo y se regrant solo columnas
-- no sensibles.
REVOKE UPDATE, INSERT ON cfdi_provider_configs FROM authenticated;
GRANT SELECT, DELETE ON cfdi_provider_configs TO authenticated;
GRANT UPDATE (provider, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal, mode, is_active, updated_at)
  ON cfdi_provider_configs TO authenticated;
GRANT INSERT (id, company_id, provider, rfc, razon_social, regimen_fiscal, codigo_postal_fiscal, mode, is_active, created_at, updated_at)
  ON cfdi_provider_configs TO authenticated;
