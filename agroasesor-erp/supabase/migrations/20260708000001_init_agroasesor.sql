-- ═══════════════════════════════════════════════════════════════════════
-- AgroAsesor-ERP — Migración inicial
-- Motor de prescripción agronómica multi-tenant (asesor → cliente → rancho → parcela)
-- Ver arquitectura completa en /AGROASESOR_ERP_ARQUITECTURA.md
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- EXTENSIONES
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ─────────────────────────────────────────────
-- FUNCIÓN COMPARTIDA: updated_at automático
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. ASESORES (tenant raíz)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE asesores (
  id_asesor       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id    UUID NOT NULL UNIQUE, -- FK lógica a auth.users (Supabase Auth)
  nombre          VARCHAR(150) NOT NULL,
  correo          VARCHAR(150) NOT NULL UNIQUE,
  cuenta_estatus  VARCHAR(30) NOT NULL DEFAULT 'activa'
                    CHECK (cuenta_estatus IN ('activa', 'suspendida', 'trial')),
  es_admin_catalogo BOOLEAN NOT NULL DEFAULT false, -- puede aprobar terminos_pendientes_validacion
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE asesores IS 'Tenant raíz. Toda separación multi-tenant se filtra por id_asesor en cascada.';

-- ═══════════════════════════════════════════════════════════════════════
-- 2. CLIENTES (empresas agrícolas del asesor)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE clientes (
  id_cliente              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_asesor               UUID NOT NULL REFERENCES asesores(id_asesor) ON DELETE CASCADE,
  nombre_comercial        VARCHAR(150) NOT NULL,
  razon_social            VARCHAR(200),
  presupuesto_anual_mxn   DECIMAL(15, 2) CHECK (presupuesto_anual_mxn >= 0),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clientes_asesor ON clientes(id_asesor);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. RANCHOS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE ranchos (
  id_rancho           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente          UUID NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
  nombre_rancho       VARCHAR(150) NOT NULL,
  ubicacion_gps       POINT,
  encargado_contacto  VARCHAR(150),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ranchos_cliente ON ranchos(id_cliente);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. CATÁLOGOS (deben existir antes de parcelas/bitácoras por las FKs)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE catalogo_plagas (
  id_plaga          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_comun      VARCHAR(150) NOT NULL,
  nombre_cientifico VARCHAR(150),
  tipo              VARCHAR(30) NOT NULL CHECK (tipo IN ('plaga', 'enfermedad', 'fisiopatia')),
  cultivares_riesgo TEXT[], -- ej. ARRAY['wichita'] — usado por el motor de riesgo (sección 6.1 del PRD)
  estatus           VARCHAR(30) NOT NULL DEFAULT 'validado'
                      CHECK (estatus IN ('validado', 'pending_validation')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE catalogo_ingredientes_coespris (
  registro_coespris_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_comercial      VARCHAR(150) NOT NULL,
  ingrediente_activo    VARCHAR(150) NOT NULL,
  categoria             VARCHAR(30) NOT NULL CHECK (categoria IN ('insecticida', 'fungicida', 'herbicida', 'fertilizante')),
  grupo_irac            VARCHAR(20), -- solo insecticidas, ej. '4A'
  grupo_frac            VARCHAR(20), -- solo fungicidas, ej. '3A'
  cultivos_autorizados  TEXT[] NOT NULL, -- valores de cultivo_tipo permitidos (registro sanitario vigente)
  lmr_ppm               DECIMAL(10, 4),
  phi_dias              SMALLINT CHECK (phi_dias >= 0),
  estatus               VARCHAR(30) NOT NULL DEFAULT 'validado'
                          CHECK (estatus IN ('validado', 'pending_validation')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_grupo_por_categoria CHECK (
    (categoria = 'insecticida' AND grupo_irac IS NOT NULL) OR
    (categoria = 'fungicida' AND grupo_frac IS NOT NULL) OR
    (categoria NOT IN ('insecticida', 'fungicida'))
  )
);
CREATE INDEX idx_coespris_irac ON catalogo_ingredientes_coespris(grupo_irac) WHERE grupo_irac IS NOT NULL;
CREATE INDEX idx_coespris_frac ON catalogo_ingredientes_coespris(grupo_frac) WHERE grupo_frac IS NOT NULL;
CREATE INDEX idx_coespris_cultivos ON catalogo_ingredientes_coespris USING GIN (cultivos_autorizados);

-- ═══════════════════════════════════════════════════════════════════════
-- 5. PARCELAS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE parcelas (
  id_parcela              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_rancho               UUID NOT NULL REFERENCES ranchos(id_rancho) ON DELETE CASCADE,
  nombre_lote             VARCHAR(100) NOT NULL,
  hectareas               DECIMAL(10, 2) NOT NULL CHECK (hectareas > 0),
  cultivo_tipo            VARCHAR(100) NOT NULL,               -- ej. 'nogal_pecanero'
  variedad_cultivar       VARCHAR(100) NOT NULL,                -- ej. 'wichita', 'western' — dispara motor de riesgo (6.1)
  ano_plantacion          SMALLINT CHECK (ano_plantacion BETWEEN 1900 AND 2100),
  zona_geografica_clima   VARCHAR(100) NOT NULL,                 -- dispara riesgo epidemiológico y restricciones de exportación (LMR por destino)
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_parcelas_rancho ON parcelas(id_rancho);
CREATE INDEX idx_parcelas_cultivar ON parcelas(variedad_cultivar);

-- ═══════════════════════════════════════════════════════════════════════
-- 6. BITÁCORAS DE VISITA (offline-first: device_id + sync_status)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE bitacoras_visita (
  id_bitacora         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_parcela          UUID NOT NULL REFERENCES parcelas(id_parcela) ON DELETE CASCADE,
  fecha_visita        DATE NOT NULL,
  etapa_fenologica    VARCHAR(100),
  sintoma_tipo        VARCHAR(150),
  diagnostico_id      UUID REFERENCES catalogo_plagas(id_plaga),
  multimedia_urls     TEXT[] NOT NULL DEFAULT '{}',    -- rutas en Object Storage, ya comprimidas (1080p/WebP/HEVC) + EXIF GPS
  estatus_alerta      VARCHAR(30) NOT NULL DEFAULT 'normal'
                        CHECK (estatus_alerta IN ('normal', 'atencion', 'critica')),

  -- offline-first
  device_id           UUID,
  sync_status         VARCHAR(20) NOT NULL DEFAULT 'synced'
                        CHECK (sync_status IN ('pending', 'synced', 'conflict')),
  created_at_local    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bitacoras_parcela ON bitacoras_visita(id_parcela);
CREATE INDEX idx_bitacoras_sync ON bitacoras_visita(sync_status) WHERE sync_status <> 'synced';
CREATE INDEX idx_bitacoras_diagnostico ON bitacoras_visita(diagnostico_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 7. EFICIENCIA DE QUÍMICOS EN CAMPO (retroalimentación post-aplicación)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE eficiencia_quimicos_campo (
  id_evaluacion               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_bitacora                 UUID NOT NULL REFERENCES bitacoras_visita(id_bitacora) ON DELETE CASCADE,
  registro_coespris_id        UUID NOT NULL REFERENCES catalogo_ingredientes_coespris(registro_coespris_id),
  fecha_evaluacion             DATE NOT NULL,
  grado_eficiencia_reportado   VARCHAR(20) NOT NULL
                                  CHECK (grado_eficiencia_reportado IN ('Excelente', 'Media', 'Nula/Resistencia')),
  observaciones_resistencia    TEXT,
  zona_geografica              VARCHAR(100),
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_eficiencia_bitacora ON eficiencia_quimicos_campo(id_bitacora);
CREATE INDEX idx_eficiencia_coespris ON eficiencia_quimicos_campo(registro_coespris_id);
CREATE INDEX idx_eficiencia_fecha ON eficiencia_quimicos_campo(fecha_evaluacion);

-- ═══════════════════════════════════════════════════════════════════════
-- 8. TÉRMINOS PENDIENTES DE VALIDACIÓN (enriquecimiento dinámico de catálogo)
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE terminos_pendientes_validacion (
  id_termino               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_asesor                UUID NOT NULL REFERENCES asesores(id_asesor),
  texto_capturado          VARCHAR(200) NOT NULL,
  tipo                     VARCHAR(30) NOT NULL CHECK (tipo IN ('plaga', 'quimico')),
  origen_id_bitacora       UUID REFERENCES bitacoras_visita(id_bitacora),
  sugerencia_nlp           JSONB,
  ficha_tecnica_preliminar JSONB,
  estatus                  VARCHAR(30) NOT NULL DEFAULT 'pending_validation'
                             CHECK (estatus IN ('pending_validation', 'aprobado', 'descartado')),
  aprobado_por             UUID REFERENCES asesores(id_asesor),
  id_catalogo_vinculado    UUID, -- FK lógica a catalogo_plagas o catalogo_ingredientes_coespris según `tipo`
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelto_at              TIMESTAMPTZ
);
CREATE INDEX idx_terminos_estatus ON terminos_pendientes_validacion(estatus) WHERE estatus = 'pending_validation';

-- ═══════════════════════════════════════════════════════════════════════
-- 9. MARKETPLACE DE INSUMOS
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE productos_comerciales (
  id_producto           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_coespris_id  UUID NOT NULL REFERENCES catalogo_ingredientes_coespris(registro_coespris_id) ON DELETE CASCADE,
  nombre_marca          VARCHAR(150) NOT NULL,
  presentacion          VARCHAR(100) -- ej. '1 L', '20 kg'
);
CREATE INDEX idx_productos_coespris ON productos_comerciales(registro_coespris_id);

CREATE TABLE sucursales_proveedores (
  id_sucursal               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_proveedor          VARCHAR(150) NOT NULL,
  geolocalizacion_tienda    POINT NOT NULL,
  telefono_contacto         VARCHAR(30)
);

CREATE TABLE inventario_sucursal (
  id_inventario                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_sucursal                  UUID NOT NULL REFERENCES sucursales_proveedores(id_sucursal) ON DELETE CASCADE,
  id_producto                  UUID NOT NULL REFERENCES productos_comerciales(id_producto) ON DELETE CASCADE,
  precio_unitario_actualizado  DECIMAL(12, 2) NOT NULL CHECK (precio_unitario_actualizado >= 0),
  nivel_disponibilidad         VARCHAR(20) NOT NULL CHECK (nivel_disponibilidad IN ('Alto', 'Bajo', 'A Pedido')),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_sucursal, id_producto)
);
CREATE INDEX idx_inventario_producto ON inventario_sucursal(id_producto);

CREATE TRIGGER trg_inventario_updated_at
  BEFORE UPDATE ON inventario_sucursal
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Telemetría anónima por zona (nunca por id_asesor / id_cliente)
CREATE TABLE telemetria_busquedas_zona (
  id_evento         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zona_geografica   VARCHAR(100) NOT NULL,
  tipo_busqueda     VARCHAR(30) NOT NULL CHECK (tipo_busqueda IN ('sintoma', 'plaga', 'ingrediente_activo')),
  termino_buscado   VARCHAR(150) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_telemetria_zona ON telemetria_busquedas_zona(zona_geografica, tipo_busqueda);

-- ═══════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — aislamiento multi-tenant por id_asesor
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE asesores ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranchos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE bitacoras_visita ENABLE ROW LEVEL SECURITY;
ALTER TABLE eficiencia_quimicos_campo ENABLE ROW LEVEL SECURITY;
ALTER TABLE terminos_pendientes_validacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY asesores_self ON asesores
  USING (auth_user_id = auth.uid());

CREATE POLICY clientes_por_asesor ON clientes
  USING (id_asesor IN (SELECT id_asesor FROM asesores WHERE auth_user_id = auth.uid()));

CREATE POLICY ranchos_por_asesor ON ranchos
  USING (
    id_cliente IN (
      SELECT c.id_cliente FROM clientes c
      JOIN asesores a ON a.id_asesor = c.id_asesor
      WHERE a.auth_user_id = auth.uid()
    )
  );

CREATE POLICY parcelas_por_asesor ON parcelas
  USING (
    id_rancho IN (
      SELECT r.id_rancho FROM ranchos r
      JOIN clientes c ON c.id_cliente = r.id_cliente
      JOIN asesores a ON a.id_asesor = c.id_asesor
      WHERE a.auth_user_id = auth.uid()
    )
  );

CREATE POLICY bitacoras_por_asesor ON bitacoras_visita
  USING (
    id_parcela IN (
      SELECT p.id_parcela FROM parcelas p
      JOIN ranchos r ON r.id_rancho = p.id_rancho
      JOIN clientes c ON c.id_cliente = r.id_cliente
      JOIN asesores a ON a.id_asesor = c.id_asesor
      WHERE a.auth_user_id = auth.uid()
    )
  );

CREATE POLICY eficiencia_por_asesor ON eficiencia_quimicos_campo
  USING (
    id_bitacora IN (
      SELECT b.id_bitacora FROM bitacoras_visita b
      JOIN parcelas p ON p.id_parcela = b.id_parcela
      JOIN ranchos r ON r.id_rancho = p.id_rancho
      JOIN clientes c ON c.id_cliente = r.id_cliente
      JOIN asesores a ON a.id_asesor = c.id_asesor
      WHERE a.auth_user_id = auth.uid()
    )
  );

CREATE POLICY terminos_por_asesor_o_admin ON terminos_pendientes_validacion
  USING (
    id_asesor IN (SELECT id_asesor FROM asesores WHERE auth_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM asesores WHERE auth_user_id = auth.uid() AND es_admin_catalogo = true)
  );

-- Catálogos (plagas, COESPRIS, marketplace) son de lectura global para todo asesor autenticado;
-- la escritura queda restringida a `es_admin_catalogo` a nivel de aplicación / función RPC.
ALTER TABLE catalogo_plagas ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalogo_ingredientes_coespris ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos_comerciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sucursales_proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario_sucursal ENABLE ROW LEVEL SECURITY;

CREATE POLICY catalogo_plagas_lectura_global ON catalogo_plagas FOR SELECT USING (true);
CREATE POLICY catalogo_coespris_lectura_global ON catalogo_ingredientes_coespris FOR SELECT USING (true);
CREATE POLICY productos_lectura_global ON productos_comerciales FOR SELECT USING (true);
CREATE POLICY sucursales_lectura_global ON sucursales_proveedores FOR SELECT USING (true);
CREATE POLICY inventario_lectura_global ON inventario_sucursal FOR SELECT USING (true);
