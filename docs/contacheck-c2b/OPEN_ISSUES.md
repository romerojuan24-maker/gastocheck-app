# ContaCheck · C2B — Open Issues / Observaciones

> Todas **no bloqueantes** y en su mayoría **intencionales** (alcance C2B). Ninguna impide el despliegue
> controlado; varias son precondiciones para la fase de despliegue.

## Observaciones de entorno
1. **Pruebas sobre esquema equivalente.** El DB local no tiene `supabase_migrations.schema_migrations` y el
   historial no es reproducible de principio a fin (`DRIFT_AUDIT_2026-07-22.md`). Se probó sobre el esquema
   equivalente vivo, que coincide objeto-por-objeto con la spec C2A (ver `DRIFT_PRECHECK.md`). **Impacto:** las
   migraciones deben re-verificarse contra el esquema **real de producción** antes de aplicar allí.
2. **DB local corre como superusuario.** Bypassa RLS por defecto; las pruebas de RLS usaron `SET ROLE
   authenticated`. En prod, validar grants reales a `service_role` (lección F1A: faltaban `INSERT audit_logs`,
   `SELECT company_members`).

## Transiciones que tocan objetos existentes (reversibles)
3. **Unicidad de `voucher_number`.** Único punto donde se reemplaza una restricción existente (global →
   parcial-legacy + compuesta) y se hace la columna nullable. Sancionado por C2A/§9; el rollback lo restaura.
   **Impacto:** en prod, verificar que no existan `voucher_number` duplicados entre empresas antes/después.

## Precondiciones para despliegue (fuera de C2B)
4. **Verificación de drift en prod** pendiente: filas en `accounting_accounts_v2` (backfill vs retiro);
   existencia de `cobra_collections`/`cobra_commissions` (migración revertida); FK `expenses`→v1; esquema de
   `accounting_vouchers`.
5. **Rollback destructivo solo sin contabilidad real.** El rollback purga datos de prueba; con pólizas reales
   `posted`, la inmutabilidad lo impide (correcto). Aplica solo en fase temprana.

## Alcance diferido (intencional)
6. **Rutas funcionales sin cambiar.** BancoCheck/FacturaCheck/GastoCheck siguen en modo `LEGACY` (INSERT directo
   verificado intacto). La migración a RPC (`SHADOW`→`CONTACHECK`) es fase posterior.
7. **Edge Functions no desplegadas.** La orquestación por eventos (adaptadores) y su despliegue son fase posterior;
   C2B entrega el núcleo DB-side (RPC).
8. **Motor de reglas: solo reglas piloto.** Las reglas funcionales completas de cada módulo se definen al integrar
   cada adaptador (C2C+).
9. **CobraCheck/NóminaCheck/Inventarios** sin integración (fuera de alcance). CobraCheck requiere primero cerrar
   brechas de datos (retenciones/moneda/nota de crédito); Inventarios requiere lógica de COGS.

## Notas de diseño menores
10. **`currency` vs `currency_code`.** Se reutilizó la columna `currency` existente (varchar) como moneda de la
    póliza; no se añadió `currency_code` para no duplicar (coherente con C2A). Los contratos lo referencian como
    moneda.
11. **`accounting_accounts_v2` vacío en local** → backfill sin efecto local. En prod puede tener filas; el bloque
    3 las porta por `(company_id, code)` sin sobrescribir.
