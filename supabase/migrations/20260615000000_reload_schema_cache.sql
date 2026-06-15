-- Fuerza recarga del schema cache de PostgREST para que reconozca
-- las columnas vehicle_id y operator_id en receipts (añadidas en fleet_vertical).
-- Sin esto, el insert da: "could not find the 'operator:id' columns of 'receipts'"
NOTIFY pgrst, 'reload schema';
