# ContaCheck C3B — RUNBOOK (ejecución futura; NO ejecutar ahora)

> Lo ejecuta **Juan** (o el pipeline) con una credencial de **escritura** a prod. El asistente **no** maneja esa
> credencial. Todo paso es reversible; ante cualquier disparo de `STOP_CONDITIONS.md`, detener.

## Pre-requisitos (todos en PASS)
1. `scripts/contacheck-c3a/05,06,07` ejecutados en prod → catálogo sano, **0 colisiones de función**, RLS/triggers
   sin sorpresas (ver `PENDING_SQL_RESULTS.md`).
2. **Backup manual reciente tomado** + PITR confirmado (ver `BACKUP_RECOVERY_CONFIRMATION.md`).
3. Integridad del paquete: `sha256sum -c CHECKSUMS.sha256` → OK.
4. Aprobación explícita del despliegue (registrada por Juan; no es secreto).

## Procedimiento
```bash
CONN="<cadena de conexión de ESCRITURA a prod — la provee Juan; no se guarda aquí>"

# 0) Preflight bloqueante (aborta si prod no está listo)
psql "$CONN" -v ON_ERROR_STOP=1 -v approved=YES -v backup_confirmed=YES -f 00_preflight.sql

# 1) Aplicar los 16 bloques EN ORDEN, cada uno en su transacción (ON_ERROR_STOP)
for f in 01_*.sql 02_*.sql 03_*.sql 04_*.sql 05_*.sql 06_*.sql 07_*.sql 08_*.sql \
         09_*.sql 10_*.sql 11_*.sql 12_*.sql 13_*.sql 14_*.sql 15_*.sql 16_*.sql; do
  echo ">> aplicando $f"; psql "$CONN" -v ON_ERROR_STOP=1 -f "$f" || { echo "STOP: fallo en $f"; exit 1; }
done

# 2) Postflight (verificación)
psql "$CONN" -v ON_ERROR_STOP=1 -f 17_postflight.sql

# 3) Verificación de flags (nadie fuera de LEGACY)
psql "$CONN" -v ON_ERROR_STOP=1 -f 19_feature_flag_verification.sql

# 4) Readiness de rollback (debe reportar 0 posted → rollback lógico seguro)
psql "$CONN" -f 20_rollback_readiness.sql

# 5) (Opcional / preferible en staging) humo transaccional NO persistente
psql "$CONN" -v ON_ERROR_STOP=1 -v smoke_company='<uuid empresa piloto interna>' -f 18_smoke_tests.sql
```

## Post-despliegue (fuera del apply)
- Regenerar tipos TypeScript de `accounting_vouchers`/`accounting_accounts`.
- **No activar** ningún flag. Todas las empresas quedan en LEGACY. La activación gradual (SHADOW→CONTACHECK) es
  una fase posterior con sus propios criterios (ver `docs/contacheck-c3a/UPDATED_GO_NO_GO.md` §Plan de activación).

## Rollback
- **Lógico** (preferido mientras 0 pólizas reales): `psql "$CONN" -f supabase/migrations/CONTACHECK_C2B_ROLLBACK.sql`
  (probado apply→rollback→reapply, 49/49 en local).
- **Físico**: restaurar el backup previo (segunda línea).

## Notas de control transaccional
Cada bloque se aplica en su propia transacción implícita con `ON_ERROR_STOP=1`: si uno falla, **no** continúa y el
bloque fallido queda **revertido** (no parcial). Los bloques son idempotentes en lo seguro (`IF NOT EXISTS`,
`CREATE OR REPLACE`); las diferencias de definición se detectan por preflight/postflight, no se ocultan.
