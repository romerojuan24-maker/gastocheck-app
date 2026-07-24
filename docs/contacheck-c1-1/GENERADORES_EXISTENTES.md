# ContaCheck · C1.1 — Generadores Contables Existentes

> Inventario real de todo lo que hoy produce pólizas/asientos, con su estado de persistencia. Solo lectura.
> Estados permitidos: `FUNCIONAL_Y_PERSISTENTE` · `FUNCIONAL_NO_PERSISTENTE` · `PARCIAL` · `DESCONECTADO` ·
> `ROTO` · `SIMULADO` · `NO_EXISTE`.

## 1. Corrección clave a C0/C1
**`accounting_vouchers` SÍ se escribe hoy** — hay **2 rutas reales** que insertan (C0 lo daba por no persistente;
era cierto solo para BancoCheck *mobile*):
- **BancoCheck web** — `apps/web/app/(dashboard)/bancocheck/conciliacion/page.tsx:187` (`generateVoucher()` en
  `:179`), INSERT `status:'draft'` usando `generatePolizaFromBankMatches()` de `apps/web/lib/poliza.ts:177`.
- **FacturaCheck mobile** — `apps/mobile/app/facturacheck/hooks/useFacturaCheck.ts:423` (`generate()`/`generateBulk`),
  INSERT con dedupe por `source_ids` (`.contains` `:381`) + audit log (`:438`). UI en `ReportsTab.tsx:24,31-43`.

**Ninguna Edge Function** escribe `accounting_vouchers` (grep en `supabase/functions/` = 0).

## 2. Tabla maestra de generadores

| Módulo | Operación | Generador | Archivo:línea | Persistencia | Nota |
|---|---|---|---|---|---|
| BancoCheck (web) | Conciliación → póliza TRANSFER/DIARIO | `generateVoucher` + `generatePolizaFromBankMatches` | `bancocheck/conciliacion/page.tsx:179-198`; `apps/web/lib/poliza.ts:177-259` | **FUNCIONAL_Y_PERSISTENTE** | INSERT `accounting_vouchers` `status:'draft'` (`page.tsx:187`) |
| FacturaCheck (mobile) | CFDI emitido → póliza INCOME | `useGenerateAccountingVoucher.generate/Bulk` | `facturacheck/hooks/useFacturaCheck.ts:373-469` | **FUNCIONAL_Y_PERSISTENTE** | INSERT real (`:423`), dedupe (`:377-384`), audit (`:438`) |
| BancoCheck (mobile) | Póliza del día (diario) | `buildLines` + `exportAs` | `bancocheck/poliza-dia.tsx:40-61,110-122` | **FUNCIONAL_NO_PERSISTENTE** | Solo `Share.share` texto (`:115`); no escribe BD. Aviso `:176-178`. Brecha P7 |
| CobraCheck | Cobro → póliza | `generatePolizaFromPayment` | `apps/web/lib/poliza.ts:43-104` | **FUNCIONAL_NO_PERSISTENTE** (+ ROTO semántico) | Objeto en memoria; **bug de signo**: cobro marcado `tipo:'EGRESO'`/Banco al HABER (`:52,62-68`) |
| CobraCheck | "Pólizas" (UI) | `polizas.tsx` | `cobracheck/polizas.tsx:6-43` | **NO_EXISTE** | Es hub de navegación (3 cards), no genera nada |
| GastoCheck | Gasto autorizado → asiento | `generate_accounting_entries` | `20260623000001_gastocheck_contabilidad_integration.sql:157-221` | **DESCONECTADO** (+ ROTO) | 0 callers; JOIN a v2 sin seed → `account_id` NULL; contrapartida `'1010'` fija (`:209`) |
| GastoCheck | Export póliza (SQL) | `export_policy_contpaqui`/`export_policy_json` | `20260623000001:224-296` | **DESCONECTADO** | Leen `accounting_entries` (vacío); sin caller |
| GastoCheck | Cierre de reembolso (web) | `generatePoliza` | `apps/web/app/(dashboard)/gastocheck/polizas/page.tsx:204-240` | **PARCIAL** | INSERT en tabla `policies` (`:211`), NO en contabilidad; sin partida doble |
| GastoCheck | Cierre de reembolso (mobile) | `generatePoliza` | `apps/mobile/app/polizas.tsx:212-249` | **PARCIAL** | INSERT `policies` (`:220`) |
| Supervisor | Cierre de reembolso | `generatePoliza` | `apps/mobile/app/supervisor/reembolsos/index.tsx:251-291` | **PARCIAL** | INSERT `policies` (`:261`); XML `<Poliza>` en memoria para compartir |
| NóminaCheck | payroll → contabilidad | — | — | **NO_EXISTE** | Sin generador; nómina aún sin UI (Fase 1B) |
| InventarioCheck | COGS / costo de ventas | — | esquema vivo `inventory_*` | **NO_EXISTE** | `inventory_movements` tiene `unit_cost` pero sin COGS/cuenta; COGS solo en esquema `inv_*` **descartado** |
| Compras / Ventas / Activos fijos | — | — | — | **NO_EXISTE** | Sin módulos/generadores dedicados |

## 3. Dos esquemas de póliza paralelos
- **`accounting_vouchers`** (encabezado + `entries` JSONB): **en uso** (2 writers). `20260705130000:66-90`.
- **`accounting_entries`** (líneas por fila, FK a v2): **código muerto** (solo lo escribiría el motor roto).
  `20260623000001:72-88`.

## 4. Códigos de cuenta hardcodeados (a mover al motor de reglas)
- `apps/web/lib/poliza.ts`: `'1010'` (`:48,154`), `'1500'` (`:49,141-142`), `'6100'` (`:84`), `'1180'` (`:155`),
  mapa `CATEGORY_ACCOUNT` `'6000'/'2100'/'1600'/'2200'/'6200'/'2300'/'3100'/'6900'` (`:140-152`).
- `apps/mobile/app/bancocheck/poliza-dia.tsx`: `'1010'` (`:17,29`) + mapa equivalente (`:18-31`).
- `apps/mobile/app/facturacheck/hooks/useFacturaCheck.ts`: `'4000'` ingresos (`:407`), `'2108'` IVA trasladado
  (`:413`), `'1200'` clientes (`:416`).
- `20260623000001:209`: `'1010'` contrapartida fija.

## 5. Conclusión
Hay **generación real y persistente** solo en BancoCheck web y FacturaCheck mobile, ambas con **cuentas
hardcodeadas** en el cliente y **sin motor de reglas central**. El resto es no-persistente, parcial (escribe
`policies`, no contabilidad), roto (motor SQL) o inexistente (Nómina/Inventario/Compras/Ventas/Activos).
ContaCheck debe: (a) centralizar reglas (quitar hardcode), (b) hacer que estos generadores propongan a
`accounting_vouchers` vía contrato normalizado, (c) construir generadores donde no existen.
