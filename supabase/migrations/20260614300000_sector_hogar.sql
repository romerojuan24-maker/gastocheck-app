-- Agrega sector 'hogar' al CHECK constraint de companies
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_sector_check;
ALTER TABLE companies ADD CONSTRAINT companies_sector_check
  CHECK (sector IN (
    'agro','construccion','alimentos','transportistas',
    'distribucion','servicios_tecnicos','manufactura',
    'comercio','hogar','otro'
  ));
