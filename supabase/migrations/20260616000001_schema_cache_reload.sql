-- Forzar recarga del schema cache de PostgREST
-- Resuelve error: Could not find column 'notes0' in schema cache
NOTIFY pgrst, 'reload schema';
