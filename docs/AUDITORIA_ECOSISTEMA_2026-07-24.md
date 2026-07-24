# CHECK SUITE — Auditoría exhaustiva del ecosistema (2026-07-24)

> Conexiones entre módulos + cadenas sin conectar. Basado en 3 auditorías read-only (con `archivo:línea`).
> Veredicto general: **las cadenas UI↔backend están SANAS**; lo "sin conectar" es (a) ContaCheck C2B **standalone
> por diseño** (faltan adaptadores — fase CT2) y (b) **código legacy huérfano** para limpiar.

## 1. Cadenas UI → backend (pantallas) — SANAS
- **9/9 rutas** registradas en `suite-apps/index.tsx` tienen pantalla. **Cero rutas rotas.**
- Todas las cadenas `pantalla → hook/RPC/función → tabla` **COMPLETAS** en BancoCheck, FacturaCheck, FlujoCheck,
  InventarioCheck, NóminaCheck (nueva), Empresas, Equipo, Administración, Settings.
- **Cero llamadas a backend inexistente** desde pantallas.
- Menor: 3 `page.tsx` re-export redundantes (facturacheck/flujocheck/inventariocheck) no enlazados — inocuos.

## 2. Conexiones entre módulos
| Origen → Destino | Vía | Estado |
|---|---|---|
| Banco/Cobra/Gasto/Nómina → **FlujoCheck (móvil)** | `bank_transactions`, `cobra_collections`, `accounts_payable`, vista `nomi_cashflow_commitments` | ✅ CONNECTED |
| Banco/Cobra/Gasto/Nómina → **FlujoCheck (web API)** | `route.ts` apuntaba a tablas inexistentes | ✅ **CORREGIDO HOY** (ahora `accounts_payable`/`cobra_invoices`/`cobra_clients`; `tax_obligations` removida) |
| BancoCheck → catálogo contable / Cobra / Proveedores | FK `bank_transactions.accounting_account_id/linked_client_id/linked_supplier_id` | ✅ CONNECTED |
| NóminaCheck → FlujoCheck | vista `nomi_cashflow_commitments` | ✅ CONNECTED (buen aislamiento; nadie más acopla nómina) |
| Advisor → todos | `advisor-correlate` lee expenses/bank/cobra/cfdi/inventory/cashflow | ✅ CONNECTED |
| FacturaCheck → Gasto/Cobra | `cfdi_documents.related_receipt_id/related_cobra_invoice_id` | ⚠️ PARCIAL — FK/columna existen pero la app inserta `null` (nunca se ligan) |
| **ContaCheck C2B → todos** | RPC `accounting_generate_voucher`… | 🔴 **STANDALONE (por diseño)** — sus RPC no tienen quien las llame; faltan los **adaptadores** (fase CT2) |

## 3. Cadenas sin conectar / código muerto (para limpiar)
- **ContaCheck C2B** (16 migraciones de hoy): flags + ~12 tablas + 8 RPC, **sin cablear** — es lo esperado
  (adaptadores = CT2, tras desplegar). No es error, es fase pendiente.
- **Legacy contable huérfano:** `accounting_accounts_v2`, `accounting_entries`, y RPC
  `generate_accounting_entries`/`export_policy_*`/`validate_cfdi_with_sat` (simulada) — **0 consumidores**;
  superados por `accounting_accounts` v1. → **deprecar** (decisión #2 de Juan: v2 fuera).
- **Tablas huérfanas** (0 consumidores): `flujo_*` (esquema v2 sin uso), `economic_indicators`,
  `transaction_suggestions/linkages/approval_rules`, `inv_*` (esquema inventario descartado).
- **Rutas stub 501:** `api/cobra/{clients,invoices,routes}` ("coming soon"). El CobraCheck real usa
  `api/cobracheck/*` — estas 3 son restos.
- **Mocks:** `cobra-sat-validator` (mock, huérfano), `validate-batch-sat` (mock, **sí cableado** en móvil →
  validación SAT por lote es falsa hoy), `advisor-ask` (IA sin integrar), `validate-cfdi-real` (el "real" existe
  pero no está cableado; la app llama `validate-cfdi`). → decisión #8 de Juan: **validación SAT real**.
- **Edge Functions sin llamador aparente** (~23 según grep de `invoke`/`functions/v1`): incluye nomi-* (nómina
  aún sin UI que las llame), authorize-expense/close-policy/reembolsos-workflow (⚠️ **posibles falsos positivos** —
  verificar si el móvil las llama por otro patrón). `process-advisor-queue` sin scheduler → cola nunca se drena.

## 4. Acciones derivadas (priorizadas)
1. ✅ **FlujoCheck web** — corregido hoy.
2. **ContaCheck:** desplegar C2B (decisión #1) → construir **adaptadores** (CT2) para conectar el motor.
3. **Validación SAT real** (#8) — reemplazar mocks `validate-cfdi`/`validate-batch-sat`/`cobra-sat-validator`.
4. **Ligar CFDI** (`related_receipt_id`/`related_cobra_invoice_id`) en FacturaCheck.
5. **Limpieza:** deprecar v2/accounting_entries; retirar tablas huérfanas (flujo_*, inv_*, transaction_*);
   quitar rutas stub `api/cobra/*`; resolver `process-advisor-queue` (scheduler o retiro).
6. **Verificar** los ~23 "orphan functions" (algunos core como authorize-expense podrían ser falsos positivos).

## Conclusión
El ecosistema en producción (los 6 módulos operativos + Advisor) está **bien conectado**; no hay cadenas rotas
en las pantallas. Los "cabos sueltos" son **ContaCheck sin sus adaptadores (fase siguiente)** y **restos legacy**
que conviene limpiar. La única cadena rota activa (FlujoCheck web) **quedó reparada en esta sesión**.
