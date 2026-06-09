-- ============================================================================
-- GastoCheck — Migration 0004: Plantillas de categorías por sector
-- ============================================================================

-- ----------------------------------------------------------------------------
-- UNIVERSAL (todas las empresas)
-- ----------------------------------------------------------------------------
INSERT INTO expense_category_templates (sector, name, description, display_order) VALUES
  ('universal', 'Combustible',              'Gasolina, diésel, gas',                      1),
  ('universal', 'Casetas / Peajes',         'Casetas de cobro y peajes',                  2),
  ('universal', 'Viáticos',                 'Alimentos y estadía en viaje',               3),
  ('universal', 'Refacciones',              'Piezas y partes para equipo',                4),
  ('universal', 'Herramientas',             'Herramienta menor y equipo',                 5),
  ('universal', 'Mantenimiento',            'Servicios de mantenimiento preventivo',       6),
  ('universal', 'Materiales',               'Materiales generales de trabajo',            7),
  ('universal', 'Transporte / Fletes',      'Envíos, mensajería y fletes',                8),
  ('universal', 'Papelería / Oficina',      'Material de oficina y papelería',            9),
  ('universal', 'Servicios',                'Servicios externos contratados',             10),
  ('universal', 'Compras menores',          'Gastos menores y misceláneos',              11),
  ('universal', 'No deducible / Pte fiscal','Sin soporte fiscal o gasto no deducible',   12);

-- ----------------------------------------------------------------------------
-- AGRO
-- ----------------------------------------------------------------------------
INSERT INTO expense_category_templates (sector, name, description, display_order) VALUES
  ('agro', 'Agroquímicos',          'Pesticidas, herbicidas, fungicidas, insecticidas',  1),
  ('agro', 'Fertilizantes',         'Fertilizantes sólidos, líquidos y foliares',        2),
  ('agro', 'Semillas / Plantas',    'Material vegetativo, semillas y plántulas',          3),
  ('agro', 'Riego',                 'Equipo, consumibles y servicio de riego',            4),
  ('agro', 'Maquinaria Agrícola',   'Renta y mantenimiento de maquinaria de campo',      5),
  ('agro', 'Combustible Agrícola',  'Diésel y gasolina para equipo agrícola',            6),
  ('agro', 'Mano de Obra Campo',    'Jornales, destajo y cuadrillas',                    7),
  ('agro', 'Empaque Agrícola',      'Cajas, bolsas, charolas, huacales, tarimas',        8),
  ('agro', 'Laboratorio / Análisis','Análisis de suelo, agua y foliar',                  9),
  ('agro', 'Fletes Agrícolas',      'Transporte de cosecha, insumos y materiales',      10),
  ('agro', 'Reparaciones de Bomba', 'Refacciones y servicio de bombas de agua',         11),
  ('agro', 'Energía / Pozo',        'Electricidad para pozo y equipos de campo',        12),
  ('agro', 'Fumigación Aérea',      'Servicio de avioneta o dron para aplicación',      13),
  ('agro', 'Certificaciones Agro',  'Certificados orgánicos, GlobalGAP, inocuidad',     14);

-- ----------------------------------------------------------------------------
-- CONSTRUCCIÓN
-- ----------------------------------------------------------------------------
INSERT INTO expense_category_templates (sector, name, description, display_order) VALUES
  ('construccion', 'Material de Obra',       'Cemento, varilla, block, arena, grava',       1),
  ('construccion', 'Herramienta Menor',      'Herramienta de mano y consumibles',           2),
  ('construccion', 'Renta de Maquinaria',    'Retroexcavadora, grúa, compactadora',         3),
  ('construccion', 'Combustible Maquinaria', 'Diésel para equipo pesado',                   4),
  ('construccion', 'Fletes / Acarreos',      'Transporte de materiales y escombro',         5),
  ('construccion', 'Mano de Obra Externa',   'Cuadrillas y subcontratistas',                6),
  ('construccion', 'Seguridad Industrial',   'EPP, señalización y protección colectiva',    7),
  ('construccion', 'Instalaciones',          'Plomería, electricidad, gas, HVAC',           8),
  ('construccion', 'Refacciones Maquinaria', 'Piezas para retroexcavadora, bulldozer, etc.',9),
  ('construccion', 'Permisos / Trámites',    'Licencias de construcción y derechos',       10),
  ('construccion', 'Viáticos de Obra',       'Hospedaje y alimentos del personal en obra', 11),
  ('construccion', 'Acabados',               'Pintura, yeso, piso, cancelería',            12);

-- ----------------------------------------------------------------------------
-- ALIMENTOS / REFRIGERADOS
-- ----------------------------------------------------------------------------
INSERT INTO expense_category_templates (sector, name, description, display_order) VALUES
  ('alimentos', 'Materia Prima',          'Ingredientes y materiales base para producción', 1),
  ('alimentos', 'Empaque',                'Envases, etiquetas, cajas, film stretch',         2),
  ('alimentos', 'Refrigeración',          'Gas refrigerante, servicio de cámaras',           3),
  ('alimentos', 'Transporte Frío',        'Flete refrigerado y distribución',               4),
  ('alimentos', 'Limpieza / Sanitización','Químicos de limpieza e higiene industrial',       5),
  ('alimentos', 'Calidad / Laboratorio',  'Análisis microbiológico y fisicoquímico',         6),
  ('alimentos', 'Mermas',                 'Pérdidas de producto en proceso y almacén',       7),
  ('alimentos', 'Uniformes / Inocuidad',  'EPP alimentario, uniformes, guantes, cofias',    8),
  ('alimentos', 'Certificaciones',        'FSSC, BRC, SQF, HACCP, FDA auditorías',          9),
  ('alimentos', 'Energía Industrial',     'Electricidad y gas para planta',                10);

-- ----------------------------------------------------------------------------
-- TRANSPORTISTAS / LOGÍSTICA
-- ----------------------------------------------------------------------------
INSERT INTO expense_category_templates (sector, name, description, display_order) VALUES
  ('transportistas', 'Diésel / Combustible',      'Combustible para unidades y equipos',         1),
  ('transportistas', 'Casetas',                   'Peajes de autopista',                          2),
  ('transportistas', 'Mantenimiento de Unidad',   'Servicio preventivo y correctivo',             3),
  ('transportistas', 'Llantas',                   'Neumáticos, reparaciones y servicio',          4),
  ('transportistas', 'Maniobras',                 'Carga, descarga y maniobras de almacén',       5),
  ('transportistas', 'Fletes Subcontratados',     'Terceros contratados para cobertura extra',    6),
  ('transportistas', 'Hospedaje / Alim. Operador','Estadía y alimentos del operador en ruta',    7),
  ('transportistas', 'Multas / Infracciones',     'Infracciones de tránsito y sanciones',        8),
  ('transportistas', 'Lavado / Limpieza',         'Lavado de unidades y cajas',                  9),
  ('transportistas', 'Seguros / Trámites',        'Pólizas de seguro, tenencias y permisos',    10),
  ('transportistas', 'GPS / Telemetría',          'Servicio de rastreo y monitoreo',             11),
  ('transportistas', 'Refacciones Unidad',        'Piezas y partes para tractos y remolques',   12);

-- ----------------------------------------------------------------------------
-- DISTRIBUCIÓN / VENTAS EN CAMPO
-- ----------------------------------------------------------------------------
INSERT INTO expense_category_templates (sector, name, description, display_order) VALUES
  ('distribucion', 'Hospedaje',          'Hotel y estadía en visita a clientes',               1),
  ('distribucion', 'Comidas',            'Alimentos y bebidas en ruta',                        2),
  ('distribucion', 'Muestras / Promo',   'Muestras de producto y material de apoyo',           3),
  ('distribucion', 'Paquetería',         'Envíos, mensajería y encomiendas',                   4),
  ('distribucion', 'Atención a Clientes','Comidas, detalles y atenciones comerciales',         5),
  ('distribucion', 'Material POP',       'Display, carteles y publicidad punto de venta',      6),
  ('distribucion', 'Devoluciones',       'Producto no cobrado, devoluciones y mermas',         7),
  ('distribucion', 'Registro / Membresía','Membresías de cadenas y cuotas de exhibición',      8);

-- ----------------------------------------------------------------------------
-- SERVICIOS TÉCNICOS
-- ----------------------------------------------------------------------------
INSERT INTO expense_category_templates (sector, name, description, display_order) VALUES
  ('servicios_tecnicos', 'Refacciones Técnicas',  'Piezas para reparación y servicio',         1),
  ('servicios_tecnicos', 'Consumibles Técnicos',  'Materiales que se consumen en el servicio', 2),
  ('servicios_tecnicos', 'Mano de Obra Externa',  'Subcontratistas y técnicos de apoyo',       3),
  ('servicios_tecnicos', 'Garantías',             'Reposición de equipos bajo garantía',       4),
  ('servicios_tecnicos', 'Paquetería',            'Envío de equipos para reparación',          5),
  ('servicios_tecnicos', 'Calibración / Cert.',   'Calibración de instrumentos y certificados',6),
  ('servicios_tecnicos', 'Software / Licencias',  'Licencias de diagnóstico y herramientas',  7);

-- ----------------------------------------------------------------------------
-- MANUFACTURA
-- ----------------------------------------------------------------------------
INSERT INTO expense_category_templates (sector, name, description, display_order) VALUES
  ('manufactura', 'Materia Prima',      'Insumos directos para producción',                   1),
  ('manufactura', 'Materiales Indirec.','Materiales de apoyo a producción',                   2),
  ('manufactura', 'Herramienta / Molde','Herramienta y moldes de producción',                 3),
  ('manufactura', 'Mantenimiento Planta','Mantenimiento de maquinaria e instalaciones',       4),
  ('manufactura', 'Energía Planta',     'Electricidad, gas y vapor industrial',               5),
  ('manufactura', 'Seguridad Planta',   'EPP y seguridad industrial',                         6),
  ('manufactura', 'Logística Interna',  'Montacargas, transpaletas, almacén',                 7),
  ('manufactura', 'Calidad',            'Control de calidad, calibración, laboratorio',       8);

-- ----------------------------------------------------------------------------
-- COMERCIO
-- ----------------------------------------------------------------------------
INSERT INTO expense_category_templates (sector, name, description, display_order) VALUES
  ('comercio', 'Compras de Mercancía', 'Mercancía para reventa',                              1),
  ('comercio', 'Fletes Entrada',       'Transporte de mercancía de proveedor',                2),
  ('comercio', 'Empaque y Display',    'Cajas, bolsas y material de exhibición',              3),
  ('comercio', 'Mermas / Robos',       'Pérdidas de inventario',                              4),
  ('comercio', 'Publicidad Local',     'Propaganda y promociones locales',                   5),
  ('comercio', 'Mantenimiento Local',  'Reparaciones en el punto de venta',                   6),
  ('comercio', 'Uniformes',            'Ropa de trabajo del personal de tienda',              7);
