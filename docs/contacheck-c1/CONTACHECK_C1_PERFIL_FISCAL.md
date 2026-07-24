# ContaCheck · C1 — Perfil Fiscal Empresarial

> Qué identidad fiscal existe hoy y diseño de `company_tax_profiles` versionado. Ref. ADR-008.

## 1. `companies` — columnas fiscales existentes (evidencia)
Base `20260606000001_init.sql:38-47`. ALTERs verificados por grep `ALTER TABLE companies`:

| Columna fiscal/dirección | Añadida en |
|---|---|
| `rfc` | `20260606000001_init.sql:41` |
| `name` (funge como razón social; no hay `razon_social`) | `init.sql:40` |
| `sector` | `20260608000003_receipts_schema.sql:16` (+ `'hogar'` `20260614300000:3-8`) |
| `nombre_comercial`, `direccion`, `ciudad`, `cp`, `telefono`, `moneda` (MXN/USD), `idioma`, `tiene_flotilla` | `20260614200000_company_fiscal_profile.sql:3-12` |
| `colonia`, `estado`, `pais` (def 'México') | `20260614400000_company_address_fields.sql:3-5` |

**Ausentes en `companies`:** `regimen_fiscal`, `codigo_postal` (solo `cp`), CSD/certificado/sello,
versionado/fecha de vigencia.

## 2. Dónde vive lo fiscal que falta
- **`regimen_fiscal`:** solo en `cfdi_provider_configs.regimen_fiscal` (`20260618300002_facturacheck_schema.sql:73`,
  emisor), `cfdi_clients.regimen_fiscal` (`20260712070000:19`, receptor), `cfdi_issue_requests.receptor_regimen`
  (`20260618300002:46`). **No** a nivel `companies`.
- **CSD (Certificado de Sello Digital):** en `cfdi_provider_configs` — `csd_cert_enc`/`csd_key_enc`/`csd_pass_enc`
  (`20260618300002:76-78`), **cifrados** con `pgp_encrypt_secret`/`pgp_decrypt_secret`
  (`20260706010000_cfdi_credentials_encryption.sql:9-27`), clave desde env `CFDI_ENC_KEY`, escribibles solo por
  Edge Function (`:47-52`). `mode` sandbox/production (`:81`). **Sin** fechas de vigencia/serie → rotación no modelada.
- **Sellos de CFDIs emitidos:** en `cfdi_documents` (`20260722100000_cfdi_sellos_timbrado.sql:8-18`:
  `sello_cfdi`, `sello_sat`, `no_certificado_*`, `cadena_original`, `fecha_timbrado`).
- **Identidad emisor duplicada:** `companies.rfc` (`init:41`) vs `cfdi_provider_configs.rfc/razon_social/
  regimen_fiscal/codigo_postal_fiscal` (`20260618300002:71-74`) → **dos verdades** del mismo dato.

## 3. Qué falta (evidencia)
- **CFDI:** emisor OK pero desnormalizado; sin fechas de vigencia de CSD.
- **Contabilidad electrónica:** sin catálogo SAT con `CodAgrupador` (`accounting_accounts` solo `code/name/
  account_type`, `init:96-104`), sin balanza/mayor/diario, sin catálogos SAT en BD (solo app-side
  `apps/mobile/lib/sat-catalogs.ts`).
- **Perfil versionado:** inexistente. Todos los campos fiscales de `companies` son de valor único in situ
  (`apps/mobile/app/administracion.tsx:110` los lee directo, sin historial). Grep de
  `company_tax_profile|tax_profile|fiscal_profile` = solo docs → **nombre libre**.

## 4. Diseño `company_tax_profiles` (versionado, no invasivo)
Entidad nueva que **consolida** la identidad hoy partida y añade lo faltante, con historial:

**Campos:** `id`, `company_id`, `valid_from`, `valid_to` (NULL = vigente), `is_active`, `rfc`,
`razon_social`, `regimen_fiscal` (**cierra D3**), `codigo_postal_fiscal`, `pais`, `moneda_funcional`,
`nombre_comercial`, `csd_config_id` (referencia a `cfdi_provider_configs` para vigencia de CSD, sin mover el
CSD), `metadata jsonb`, auditoría en `audit_logs`.

**Consumidores previstos:** ContaCheck (identidad del emisor en pólizas/export SAT), FacturaCheck (deja de
depender solo de `cfdi_provider_configs`), reportes contables. Para **evitar duplicar**, se expone una vista
de compatibilidad `companies_fiscal_v` que resuelve el perfil activo, y los módulos migran a ella
progresivamente; `companies` conserva sus columnas como legado leído.

**No invasivo:** tabla nueva + vista; `companies` y `cfdi_provider_configs` intactos. Rollback = `DROP` tabla/vista.

**Protección de datos:** el CSD permanece cifrado en su tabla (no se copia al perfil). El perfil no guarda
secretos, solo identidad fiscal + punteros de vigencia.
