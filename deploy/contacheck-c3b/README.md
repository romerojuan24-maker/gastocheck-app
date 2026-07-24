# ContaCheck C3B — Paquete de despliegue AISLADO (NO EJECUTADO)

Contiene **exclusivamente** los 16 bloques de C2B + envoltorios de verificación. **No** incluye migraciones
históricas ajenas. Preparado por C3A.1; **no ejecutado**.

## Contenido
- `00_preflight.sql` — prechecks bloqueantes (aborta si prod no está listo).
- `01_*.sql` … `16_*.sql` — los 16 bloques C2B (copia fiel de `supabase/migrations/20260724000001..16`).
- `17_postflight.sql` — verificación posterior (18 tablas, 41 cols, funciones, RLS, flags LEGACY).
- `18_smoke_tests.sql` — humo **transaccional no persistente** (`BEGIN … ROLLBACK`).
- `19_feature_flag_verification.sql` — confirma que **nadie** quedó en SHADOW/CONTACHECK.
- `20_rollback_readiness.sql` — confirma que el rollback lógico es seguro (0 pólizas posted).
- `MANIFEST.json` — orden, checksum, propósito, objetos, operación, riesgo, transaccional, pre/post, rollback.
- `CHECKSUMS.sha256` — verificación de integridad de todos los `.sql`.
- `RUNBOOK.md` — procedimiento paso a paso (lo ejecuta Juan/pipeline con credencial de escritura; el asistente NO).
- `STOP_CONDITIONS.md` — condiciones de parada inmediata + acción/rollback/responsable.

## Regla de oro del método
**APLICAR SOLO estos 16 bloques en aislamiento** (`psql -f`), **NUNCA `supabase db push`** — un push arrastraría
~13 migraciones locales no registradas en prod (ver `docs/contacheck-c3a/MIGRATION_HISTORY_RECONCILIATION.md`).

## Verificar integridad antes de usar
```
cd deploy/contacheck-c3b && sha256sum -c CHECKSUMS.sha256
```

## Estado
Paquete **preparado, no ejecutado**. Requiere: prechecks `05/06/07` de C3A en PASS + backup/PITR confirmado +
aprobación explícita. Ver `docs/contacheck-c3a/UPDATED_GO_NO_GO.md`.
