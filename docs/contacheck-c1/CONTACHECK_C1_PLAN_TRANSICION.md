# ContaCheck · C1 — Plan de Transición

> Transición por etapas, aditiva y reversible. Cada etapa: cambios · riesgos · rollback · pruebas ·
> condición de avance. **No hay gran migración simultánea.** Ref. §14 del prompt.

## Gate previo (antes de Etapa 1)
Verificar objetos reales en prod (ver `CONTACHECK_C1_COMPATIBILIDAD.md §3`) y ratificación de Juan de las
decisiones abiertas (ver Resumen Ejecutivo §decisiones). Sin esto, no se implementa.

## Etapa 1 — Congelamiento de nuevas duplicaciones
- **Cambios:** norma documental — ningún objeto nuevo escribe `accounting_accounts_v2`, `accounting_entries`
  (v2), ni crea tablas de terceros/cuentas paralelas. No hay cambio de esquema.
- **Riesgos:** ninguno técnico (es política).
- **Rollback:** N/A.
- **Pruebas:** revisión de PRs (checklist de no-duplicación).
- **Avance si:** política acordada.

## Etapa 2 — Capa de compatibilidad (aditiva)
- **Cambios:** `CREATE VIEW` (`contacheck_expense_account_v`, `companies_fiscal_v`); `ADD COLUMN NULL`
  (columnas fiscales en v1; `party_id` opcional por módulo; ampliaciones de `accounting_vouchers`; puente
  bancario; `company_tax_profiles` como tabla nueva).
- **Riesgos:** bajos (todo NULL-able/vistas). Colisión de nombre `account_type` → usar `account_type_norm`.
- **Rollback:** `DROP VIEW` / `DROP COLUMN` (NULL, sin datos) / `DROP TABLE` nuevas.
- **Pruebas:** las vistas devuelven datos consistentes; RLS de tablas nuevas; smoke de que módulos existentes
  no cambian de comportamiento.
- **Avance si:** vistas y columnas creadas, consumidores existentes sin regresión.

## Etapa 3 — Adaptador piloto (BancoCheck) + motor
- **Cambios:** motor de contabilización (RPC/función) que lee v1 + reglas extraídas de `poliza.ts`
  (corregidas) y **persiste en `accounting_vouchers`** con `status='proposed'`. Adaptador BancoCheck: al
  `bancocheck_approve_suggestion` (`20260712050000`), emitir movimiento contabilizable (vía vista o llamada).
  Sin modificar el módulo BancoCheck.
- **Riesgos:** doble contabilización → idempotencia por `idempotency_key`. Signo/So contrapartida → tests.
- **Rollback:** feature flag off; las pólizas propuestas no afectan a los módulos; se pueden marcar `cancelled`.
- **Pruebas:** póliza balanceada (`debe=haber`), idempotencia, RLS, VoBo respetado, conciliación cuadra.
- **Avance si:** N movimientos reales producen pólizas propuestas correctas sin tocar BancoCheck.

## Etapa 4 — Pólizas propuestas (revisión del contador)
- **Cambios:** UI/flujo de revisión de pólizas `proposed`; VoBo `approved_by`.
- **Riesgos:** ergonomía; falsos positivos de clasificación.
- **Rollback:** flag off; propuestas quedan inertes.
- **Pruebas:** el contador aprueba/rechaza; auditoría en `audit_logs`.
- **Avance si:** flujo de aprobación estable.

## Etapa 5 — Contabilización controlada (`posted`)
- **Cambios:** transición `proposed→posted` con trigger de inmutabilidad; numeración por empresa/período.
- **Riesgos:** edición de póliza contabilizada → trigger la bloquea. Reversa mal formada → póliza espejo.
- **Rollback:** solo por reversa (contra-asiento), nunca DELETE.
- **Pruebas:** intento de editar `posted` falla; reversa balancea; período no re-contabiliza.
- **Avance si:** ciclo propuesto→contabilizado→reversado probado.

## Etapa 6 — Migración gradual de referencias
- **Cambios:** reapuntar motor a v1 (ya en piloto); poblar `party_id` por lotes; consumidores fiscales →
  `companies_fiscal_v`; extender adaptadores a GastoCheck → NóminaCheck → CobraCheck (tras cerrar sus brechas
  de datos: retenciones/moneda/nota de crédito).
- **Riesgos:** cobertura parcial → `log` de lo no migrado (sin truncado silencioso).
- **Rollback:** por módulo (flag).
- **Pruebas:** por adaptador, pólizas correctas + conciliación.
- **Avance si:** cada módulo contabiliza correctamente.

## Etapa 7 — Retiro de objetos legados
- **Cambios:** deprecar `accounting_accounts_v2`, `accounting_entries` (v2), `generate_accounting_entries`/
  `export_policy_*`; limpiar `expenses.accounting_account_code` desnormalizado.
- **Riesgos:** dependencia oculta → verificar 0 consumidores (grep + prod) antes de cada `DROP`.
- **Rollback:** restaurar desde migración/backup (objetos aislados).
- **Pruebas:** 0 referencias vivas; smoke completo.
- **Avance si:** evidencia de 0 dependencias.

## Resumen de reversibilidad
Etapas 1–6 son **100% aditivas/flag-controladas** → rollback sin pérdida. Solo la Etapa 7 hace `DROP`, y solo
con evidencia de cero dependencias y backup. La contabilidad nunca se edita/borra: se corrige por reversa.
