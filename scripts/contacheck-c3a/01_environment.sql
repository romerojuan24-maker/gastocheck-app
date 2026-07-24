-- ContaCheck C3A · 01 — Identificación de entorno (SOLO LECTURA, sin secretos)
-- Confirma que se está consultando la base correcta y registra fecha/hora.
select
  current_database()                        as database,
  current_user                             as current_role,
  inet_server_addr()                       as server_addr,   -- puede ser null en pooler
  version()                                as pg_version,
  current_setting('server_version_num')    as pg_version_num,
  now()                                     as inspected_at_utc,
  (select count(*) from pg_database)        as db_count;

-- Extensiones relevantes (pgcrypto para cifrado PII/CFDI).
select extname, extversion from pg_extension order by extname;

-- Esquemas presentes (esperado: public, auth, storage, extensions, ...).
select nspname from pg_namespace where nspname not like 'pg_%' and nspname <> 'information_schema' order by nspname;
