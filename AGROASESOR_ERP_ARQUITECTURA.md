# 🌱 AgroAsesor-ERP — Arquitectura Completa

**Estado**: Draft de arquitectura (no implementado)
**Fecha**: 2026-07-08
**Versión**: 1.0.0
**Región objetivo**: Latinoamérica / México (Chihuahua — nogal pecanero)
**Patrón**: Offline-First, Multi-Tenant Relacional, Basado en Eventos

> ⚠️ **Nota de alcance**: AgroAsesor-ERP es un producto independiente de asesoría agronómica (nogal pecanero, huertas, plagas, agroquímicos). No pertenece a la familia CHECK SUITE (GastoCheck / BancoCheck / FacturaCheck / FlujoCheck / CobraCheck) que vive en este mismo repositorio — esas apps resuelven control de gastos y cumplimiento fiscal SAT para empresas. AgroAsesor-ERP resuelve un problema de dominio distinto (diagnóstico fitosanitario y gestión de cartera de un asesor agronómico independiente) y usa un stack de backend distinto (Python en vez de Next.js/Edge Functions). Este documento describe la arquitectura propuesta; la decisión de si se implementa dentro de este monorepo (como app nueva) o en un repositorio propio queda pendiente de confirmación.

---

## 1. Visión y resumen ejecutivo

AgroAsesor-ERP es el motor de prescripción agronómica para **asesores agronómicos independientes** que gestionan carteras de múltiples clientes (empresas agrícolas), cada una con uno o más ranchos y parcelas. El asesor visita huertas en campo — a menudo sin conectividad — registra diagnósticos fitosanitarios, evidencia fotográfica georreferenciada, y emite órdenes de aplicación de agroquímicos que deben respetar la regulación mexicana (COFEPRIS/COESPRIS): rotación de grupos IRAC/FRAC, límites máximos de residuo (LMR) e intervalos de preseguridad (PHI).

```
Asesor
  └── Cliente (empresa agrícola)
        └── Rancho
              └── Parcela
                    └── Bitácora de visita (diagnóstico, síntoma, multimedia)
                          └── Evaluación de eficiencia de químicos (post-aplicación)
```

---

## 2. Pilares tecnológicos mandatorios

1. **Offline-first real**: el cliente móvil trae localmente el vademécum de agroquímicos, el catálogo fitosanitario y la agenda de visitas en una base cifrada (SQLite/SQLCipher en RN, IndexedDB cifrado como fallback web). Las mutaciones se encolan y se reconcilian de forma asíncrona cuando hay red.
2. **Aislamiento multi-tenant relacional**: todo query pasa por `id_asesor` (y en cascada `id_cliente` → `id_rancho` → `id_parcela`). Un asesor jamás ve datos de otro asesor; RLS a nivel de Postgres además de filtrado en la capa de API.
3. **Optimización multimedia en cliente**: fotos/video de evidencia de plaga se comprimen (máx. 1080p, WebP para imagen, HEVC/H.265 para video ≤10s) e inyectan EXIF de georreferenciación **antes** de subir a Object Storage (Supabase Storage / S3).
4. **Knowledge graph agronómico dinámico**: catálogo de plagas, cultivares, ingredientes activos e interacciones modelado como grafo para diagnóstico (síntoma → plaga candidata → tratamiento válido para el cultivo).
5. **Pipeline de enriquecimiento automático**: términos no encontrados en el catálogo (plaga o químico capturado en campo) se aceptan como texto libre, se marcan `pending_validation`, y disparan un flujo de matching NLP + revisión de administrador para expandir el catálogo oficial.

---

## 3. Arquitectura general

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│   Cliente móvil (RN/Flutter) │        │        Backend API           │
│                               │        │   (FastAPI / Flask + Python) │
│  ┌─────────────────────────┐ │  sync  │                              │
│  │ SQLite cifrado (local)   │◄├────────┤  PostgreSQL (Supabase)      │
│  │ - vademécum offline      │ │  queue │  - multi-tenant por asesor  │
│  │ - agenda de visitas      │ │        │  - RLS por id_asesor        │
│  │ - cola de mutaciones     │ │        │                              │
│  └─────────────────────────┘ │        │  Object Storage (Supabase/S3)│
│                               │        │  - fotos/video comprimidos  │
│  Compresión multimedia local  │───────►│                              │
│  (1080p / WebP / HEVC)        │        │  Motor de reglas COESPRIS   │
└─────────────────────────────┘        │  (IRAC/FRAC, LMR, PHI)      │
                                         │                              │
                                         │  Pipeline NLP enriquecimiento│
                                         └──────────────────────────────┘
```

---

## 4. Modelo de datos (PostgreSQL / Supabase)

Jerarquía: `asesores → clientes → ranchos → parcelas → bitacoras_visita → eficiencia_quimicos_campo`, más catálogos de soporte (cultivares, plagas, ingredientes activos COESPRIS).

```sql
-- ─────────────────────────────────────────────
-- 1. ASESORES (tenant raíz)
-- ─────────────────────────────────────────────
CREATE TABLE asesores (
  id_asesor       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          VARCHAR(150) NOT NULL,
  correo          VARCHAR(150) NOT NULL UNIQUE,
  cuenta_estatus  VARCHAR(30) NOT NULL DEFAULT 'activa', -- activa, suspendida, trial
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 2. CLIENTES (empresas agrícolas del asesor)
-- ─────────────────────────────────────────────
CREATE TABLE clientes (
  id_cliente              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_asesor               UUID NOT NULL REFERENCES asesores(id_asesor) ON DELETE CASCADE,
  nombre_comercial        VARCHAR(150) NOT NULL,
  razon_social            VARCHAR(200),
  presupuesto_anual_mxn   DECIMAL(15, 2),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clientes_asesor ON clientes(id_asesor);

-- ─────────────────────────────────────────────
-- 3. RANCHOS
-- ─────────────────────────────────────────────
CREATE TABLE ranchos (
  id_rancho           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_cliente          UUID NOT NULL REFERENCES clientes(id_cliente) ON DELETE CASCADE,
  nombre_rancho       VARCHAR(150) NOT NULL,
  ubicacion_gps       POINT,               -- lat/lng
  encargado_contacto  VARCHAR(150),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ranchos_cliente ON ranchos(id_cliente);

-- ─────────────────────────────────────────────
-- 4. PARCELAS
-- ─────────────────────────────────────────────
CREATE TABLE parcelas (
  id_parcela              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_rancho               UUID NOT NULL REFERENCES ranchos(id_rancho) ON DELETE CASCADE,
  nombre_lote             VARCHAR(100) NOT NULL,
  hectareas               DECIMAL(10, 2) NOT NULL,
  cultivo_tipo            VARCHAR(100) NOT NULL,   -- ej. 'nogal_pecanero'
  variedad_cultivar       VARCHAR(100) NOT NULL,   -- ej. 'wichita', 'western' — dispara el motor de riesgo epidemiológico (6.1)
  ano_plantacion          SMALLINT,
  zona_geografica_clima   VARCHAR(100) NOT NULL,   -- dispara riesgo epidemiológico y restricciones de mercado de exportación (LMR por destino)
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_parcelas_rancho ON parcelas(id_rancho);
CREATE INDEX idx_parcelas_cultivar ON parcelas(variedad_cultivar);

-- ─────────────────────────────────────────────
-- 5. BITÁCORAS DE VISITA
-- ─────────────────────────────────────────────
CREATE TABLE bitacoras_visita (
  id_bitacora         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_parcela          UUID NOT NULL REFERENCES parcelas(id_parcela) ON DELETE CASCADE,
  fecha_visita        DATE NOT NULL,
  etapa_fenologica    VARCHAR(100),
  sintoma_tipo        VARCHAR(150),
  diagnostico_id      UUID REFERENCES catalogo_plagas(id_plaga),
  multimedia_urls     TEXT[],                 -- rutas en Object Storage, ya comprimidas
  estatus_alerta      VARCHAR(30) DEFAULT 'normal', -- normal, atencion, critica

  -- soporte offline-first
  device_id           UUID,                   -- dispositivo que originó el registro
  sync_status         VARCHAR(20) DEFAULT 'synced', -- pending, synced, conflict
  created_at_local    TIMESTAMPTZ,             -- timestamp del dispositivo (puede ser < created_at)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bitacoras_parcela ON bitacoras_visita(id_parcela);
CREATE INDEX idx_bitacoras_sync ON bitacoras_visita(sync_status) WHERE sync_status <> 'synced';

-- ─────────────────────────────────────────────
-- 6. EFICIENCIA DE QUÍMICOS EN CAMPO (post-aplicación)
-- ─────────────────────────────────────────────
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

-- ─────────────────────────────────────────────
-- 7. CATÁLOGOS DE SOPORTE
-- ─────────────────────────────────────────────
CREATE TABLE catalogo_plagas (
  id_plaga        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_comun    VARCHAR(150) NOT NULL,
  nombre_cientifico VARCHAR(150),
  tipo            VARCHAR(50), -- plaga, enfermedad, fisiopatia
  estatus         VARCHAR(30) DEFAULT 'validado' -- validado, pending_validation
);

CREATE TABLE catalogo_ingredientes_coespris (
  registro_coespris_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_comercial      VARCHAR(150) NOT NULL,
  ingrediente_activo    VARCHAR(150) NOT NULL,
  categoria             VARCHAR(30) NOT NULL, -- insecticida, fungicida, herbicida
  grupo_irac            VARCHAR(20),           -- solo insecticidas
  grupo_frac            VARCHAR(20),           -- solo fungicidas
  cultivos_autorizados  TEXT[] NOT NULL,       -- cultivo_tipo permitidos
  lmr_ppm               DECIMAL(10, 4),        -- límite máximo de residuo
  phi_dias              SMALLINT,              -- intervalo de preseguridad
  estatus               VARCHAR(30) DEFAULT 'validado'
);

-- ─────────────────────────────────────────────
-- 8. TÉRMINOS PENDIENTES DE VALIDACIÓN (enriquecimiento dinámico)
-- ─────────────────────────────────────────────
CREATE TABLE terminos_pendientes_validacion (
  id_termino            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_asesor             UUID NOT NULL REFERENCES asesores(id_asesor),
  texto_capturado       VARCHAR(200) NOT NULL,        -- ej. "Hongo morado de la corteza"
  tipo                  VARCHAR(30) NOT NULL,          -- plaga, quimico
  origen_id_bitacora    UUID REFERENCES bitacoras_visita(id_bitacora),
  sugerencia_nlp        JSONB,                          -- candidatos de match por similitud + score
  ficha_tecnica_preliminar JSONB,                       -- generada por el background worker (repos biológicos + COESPRIS)
  estatus               VARCHAR(30) DEFAULT 'pending_validation', -- pending_validation, aprobado, descartado
  aprobado_por          UUID REFERENCES asesores(id_asesor), -- admin que aprobó (si aplica)
  id_catalogo_vinculado UUID,                           -- FK a catalogo_plagas o catalogo_ingredientes_coespris una vez aprobado
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 9. MARKETPLACE DE INSUMOS
-- ─────────────────────────────────────────────
CREATE TABLE productos_comerciales (
  id_producto           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_coespris_id  UUID NOT NULL REFERENCES catalogo_ingredientes_coespris(registro_coespris_id),
  nombre_marca          VARCHAR(150) NOT NULL,
  presentacion          VARCHAR(100) -- ej. "1 L", "20 kg"
);

CREATE TABLE sucursales_proveedores (
  id_sucursal               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_proveedor          VARCHAR(150) NOT NULL,
  geolocalizacion_tienda    POINT NOT NULL,
  telefono_contacto         VARCHAR(30)
);

CREATE TABLE inventario_sucursal (
  id_inventario             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_sucursal               UUID NOT NULL REFERENCES sucursales_proveedores(id_sucursal) ON DELETE CASCADE,
  id_producto               UUID NOT NULL REFERENCES productos_comerciales(id_producto) ON DELETE CASCADE,
  precio_unitario_actualizado DECIMAL(12, 2) NOT NULL,
  nivel_disponibilidad      VARCHAR(20) NOT NULL CHECK (nivel_disponibilidad IN ('Alto', 'Bajo', 'A Pedido')),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inventario_producto ON inventario_sucursal(id_producto);

-- Telemetría anónima de búsquedas (por zona, no por asesor) para modelos predictivos de desabasto
CREATE TABLE telemetria_busquedas_zona (
  id_evento         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zona_geografica   VARCHAR(100) NOT NULL,
  tipo_busqueda     VARCHAR(30) NOT NULL, -- sintoma, plaga, ingrediente_activo
  termino_buscado   VARCHAR(150) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Row Level Security (aislamiento multi-tenant)

Cada tabla hija filtra en cascada por `id_asesor` vía join implícito. Ejemplo de política en `clientes`:

```sql
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY clientes_por_asesor ON clientes
  USING (id_asesor = auth.uid());
```

Para tablas más profundas (`parcelas`, `bitacoras_visita`, `eficiencia_quimicos_campo`) la política se expresa como subquery contra la tabla padre, para no duplicar `id_asesor` en cada tabla:

```sql
CREATE POLICY parcelas_por_asesor ON parcelas
  USING (
    id_rancho IN (
      SELECT r.id_rancho FROM ranchos r
      JOIN clientes c ON c.id_cliente = r.id_cliente
      WHERE c.id_asesor = auth.uid()
    )
  );
```

---

## 5. Sincronización offline-first

**Flujo de una visita sin conectividad:**

1. El asesor abre la app; el vademécum, catálogo fitosanitario y agenda de visitas ya están en SQLite local (descargados en la última sincronización).
2. Captura diagnóstico + fotos/video → compresión local (1080p/WebP/HEVC) + EXIF GPS inyectado.
3. El registro se guarda localmente con `sync_status = 'pending'` y `device_id` propio.
4. Cuando se detecta red, un worker de sincronización:
   - Sube primero los binarios (multimedia) a Object Storage.
   - Envía las filas pendientes al backend en lotes (`bitacoras_visita`, `eficiencia_quimicos_campo`).
   - Resuelve conflictos por **last-write-wins basado en `created_at_local`**, salvo en campos críticos de diagnóstico donde se conserva ambas versiones y se marca `sync_status = 'conflict'` para revisión manual del asesor.
5. El backend confirma; el cliente marca `sync_status = 'synced'` y libera la cola local.

**Catálogos** (vademécum, plagas, ingredientes COESPRIS) se sincronizan en sentido servidor → cliente con versión incremental (`updated_at` + `catalog_version`), para que el dispositivo solo descargue deltas.

---

## 6. Reglas de negocio agronómicas

### 6.1 Perfiles de riesgo por cultivar (nogal pecanero)

| Cultivar | Riesgos prioritarios | Fisiopatías | Regla de disparo |
|---|---|---|---|
| **Wichita** | Cenicilla (*Microsphaera alni*), Cenicienta / mancha de la hoja (*Cercospora fusca*) | Fruto vano por sobreproducción, debilidad estructural de ramas | Si `variedad_cultivar == 'Wichita'` y Humedad Relativa de la zona > 75% → anteponer alertas fitosanitarias preventivas en la pantalla de inicio de la agenda del asesor |
| **Western Schley** | Pulgón amarillo, pulgón negro (*Melanocallis caryaefoliae*) — alta atracción | Alta demanda metabólica de zinc (riesgo de arrosetamiento severo) | Si `variedad_cultivar == 'Western'` → el algoritmo de fertilización foliar incrementa automáticamente la dosis sugerida de sulfato de zinc en **+15%**, y el conteo de insectos por folíolo se prioriza según los modelos térmicos de acumulación de Días Grado (Unidades Calor) |

El motor de diagnóstico usa `variedad_cultivar` + `zona_geografica_clima` + condiciones ambientales capturadas en la bitácora para priorizar candidatos de diagnóstico antes de mostrar el catálogo completo, y como entrada directa a los ajustes automáticos de dosis/prioridad de monitoreo descritos arriba.

### 6.2 Motor de cumplimiento COESPRIS/COFEPRIS

Al generar una orden de aplicación, el motor debe:

1. **Filtrar por cultivo autorizado**: solo mostrar ingredientes activos cuyo `cultivos_autorizados` incluya el `cultivo_tipo` de la parcela.
2. **Exponer grupo IRAC/FRAC**: para forzar rotación de modo de acción entre aplicaciones.
3. **Calcular LMR y PHI dinámicamente**: antes de emitir la orden, validar que la fecha de cosecha estimada respete el `phi_dias` del producto.
4. **Bloquear repetición de grupo IRAC/FRAC en ventana de 30 días** en la misma parcela — ejemplo concreto: si una parcela registró una aplicación del **Grupo 4A (Neonicotinoides)** en los últimos 30 días, el buscador bloquea o emite advertencia crítica si el asesor intenta seleccionar otro producto del Grupo 4A, forzando la sugerencia hacia grupos alternos (ej. **Grupo 29** o **Grupo 3A**) para romper el ciclo de resistencia genética de la plaga en la zona:

```sql
-- Pseudocódigo de validación antes de autorizar una nueva aplicación
SELECT COUNT(*) FROM eficiencia_quimicos_campo eq
JOIN bitacoras_visita b ON b.id_bitacora = eq.id_bitacora
JOIN catalogo_ingredientes_coespris c ON c.registro_coespris_id = eq.registro_coespris_id
WHERE b.id_parcela = :id_parcela
  AND (c.grupo_irac = :grupo_nuevo OR c.grupo_frac = :grupo_nuevo)
  AND eq.fecha_evaluacion >= (:fecha_propuesta - INTERVAL '30 days');
-- COUNT > 0 → bloquear y sugerir grupo alterno
```

### 6.3 Pipeline de enriquecimiento dinámico

1. **Búsqueda predictiva (typeahead)**: en la captura de bitácora móvil, un componente typeahead con scroll dinámico busca contra el catálogo local. Si el asesor encuentra el término (ej. "Pulgón Negro"), lo selecciona y se indexa el `id_plaga` oficial — no se genera ningún término pendiente.
2. **Entrada libre en falla de búsqueda**: si el término no existe en catálogo, se habilita un input de texto plano. El asesor escribe el nombre provisional (ej. *"Hongo morado de la corteza"*), adjunta evidencia multimedia y el registro se guarda localmente con `sync_status = 'pending'`.
3. **Ingesta en el servidor central**: al sincronizar, el payload crea una fila en `terminos_pendientes_validacion` (`estatus = 'pending_validation'`).
4. **NLP de sinónimos regionales**: un job evalúa si el término es un sinónimo regional de una entrada ya catalogada — ejemplo: *"Pulgón prieto"* se mapea automáticamente a *"Pulgón Negro"* (`sugerencia_nlp` guarda el candidato + score de similitud). Si el score supera el umbral de confianza, el sistema puede auto-vincular sin pasar por revisión manual.
5. **Ficha técnica preliminar (background worker)**: si el término es genuinamente nuevo (no hay match de sinónimo), un worker en segundo plano consulta repositorios biológicos externos y el catálogo COESPRIS buscando coincidencias, y genera una ficha técnica preliminar (`ficha_tecnica_preliminar`).
6. **Aprobación global en un clic**: la ficha se envía al panel del administrador central del catálogo, quien aprueba (crea/vincula `id_catalogo_vinculado` en `catalogo_plagas` o `catalogo_ingredientes_coespris`, quedando disponible para **todos** los asesores) o descarta (queda como sinónimo regional aislado, sin expansión de catálogo global).

---

## 7. Integración de marketplace

**Modelo de datos**: cada `registro_coespris_id` (ingrediente activo autorizado) se vincula a uno o más `productos_comerciales` (marca/presentación), y cada producto comercial tiene disponibilidad por `sucursales_proveedores` vía `inventario_sucursal` (`precio_unitario_actualizado`, `geolocalizacion_tienda`, `nivel_disponibilidad`: Alto / Bajo / A Pedido).

**Algoritmo de optimización financiera del reporte**: al generar la receta final y la orden de trabajo para el dueño de la huerta, el sistema calcula la ruta de compra óptima considerando:

1. **Presupuesto disponible**: se contrasta la cotización total de agroquímicos contra el presupuesto asignado a la etapa fenológica actual de la parcela (derivado de `presupuesto_anual_mxn` del cliente, prorrateado por etapa/ciclo) — si la cotización lo excede, el sistema **bloquea o alerta** antes de emitir la orden.
2. **Distancia por carretera**: entre las sucursales con `nivel_disponibilidad` suficiente, se prioriza la más cercana por ruta real (no distancia en línea recta) al rancho afectado.
3. **Ruteo de compra por afiliación**: la orden final se enruta a la sucursal/proveedor afiliado seleccionado por el algoritmo.

**Telemetría de tendencias comerciales**: se registran de forma **anónima** (por `zona_geografica`, nunca por `id_asesor` o `id_cliente`) las búsquedas de síntomas/plagas/ingredientes activos (`telemetria_busquedas_zona`), para alimentar modelos predictivos de desabasto que permitan a proveedores premium anticipar demanda regional en sus almacenes.

Todas estas features consumen `registro_coespris_id` como llave de correlación entre la recomendación técnica y el catálogo comercial.

---

## 8. Stack técnico propuesto

| Capa | Tecnología |
|---|---|
| Backend API | Python — FastAPI (preferido sobre Flask por async nativo y validación con Pydantic) |
| Base de datos | PostgreSQL vía Supabase (Auth + Storage + RLS ya incluidos) |
| Cliente móvil | React Native (Expo) o Flutter — a decidir según equipo disponible |
| Persistencia local | SQLite + SQLCipher (cifrado en reposo) |
| Object storage | Supabase Storage (o S3 si se requiere multi-región) |
| Compresión multimedia | `libwebp` (imagen) y `libx265`/HEVC (video) en el cliente antes del upload |
| Matching NLP (sinónimos) | Embeddings + búsqueda por similitud (pgvector en Postgres, o servicio externo) |

> Este stack es deliberadamente distinto al de GastoCheck (Next.js + Edge Functions en TypeScript) porque el dominio y el equipo objetivo son distintos. Si se decide alojar AgroAsesor-ERP en este mismo monorepo, se recomienda un paquete/app aislado (p. ej. `apps/agroasesor-api` + `apps/agroasesor-mobile`) sin compartir código con el Check Suite, dado que no hay lógica de negocio en común.

---

## 9. Roadmap de implementación

- **Fase 1 — Fundamentos**: schema Postgres + RLS multi-tenant, autenticación de asesores, CRUD de clientes/ranchos/parcelas.
- **Fase 2 — Bitácoras y offline**: captura de bitácoras de visita, SQLite local cifrado, cola de sincronización, compresión multimedia en cliente.
- **Fase 3 — Motor agronómico**: catálogo de plagas/cultivares, reglas de riesgo por cultivar (Wichita/Western), diagnóstico asistido.
- **Fase 4 — Cumplimiento COESPRIS**: catálogo de ingredientes activos, motor IRAC/FRAC, cálculo de LMR/PHI, bloqueo de rotación 30 días.
- **Fase 5 — Enriquecimiento dinámico**: flujo de términos pendientes, matching NLP, panel de administración de catálogo.
- **Fase 6 — Marketplace**: mapeo de tiendas, alertas de stock, ruteo de afiliados, comparación de precios.

---

## 10. Riesgos y puntos abiertos

- **Conectividad intermitente en campo real**: validar el tamaño de la cola de sincronización y el comportamiento ante conflictos de diagnóstico (dos técnicos en la misma parcela el mismo día).
- **Fuente de verdad regulatoria**: el catálogo COESPRIS/COFEPRIS cambia; se necesita un proceso de actualización periódica del catálogo oficial, separado del pipeline de enriquecimiento por sinónimos.
- **Cobertura de cultivares**: el documento fuente solo detalla Wichita y Western (nogal pecanero); expandir a otros cultivos requiere el mismo patrón de reglas pero con nuevo contenido agronómico.
- **Repositorio de destino**: pendiente confirmar si este producto vive en su propio repositorio o como app aislada dentro de `gastocheck-app`.
