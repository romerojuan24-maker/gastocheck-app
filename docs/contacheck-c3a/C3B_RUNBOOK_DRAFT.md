# ContaCheck · C3B — Runbook (BORRADOR) — Despliegue controlado de C2B a producción

> Borrador para la fase C3B (no ejecutar aquí). Refleja las condiciones detectadas en este gate.

## Precondiciones (deben estar en PASS antes de iniciar)
1. Scripts `scripts/contacheck-c3a/06,07` ejecutados en prod → **0 colisiones de función**, RLS/políticas sin
   sorpresas, sin vistas SECURITY DEFINER que hagan bypass.
2. `05` ejecutado → catálogo v1 sin duplicados; jerarquía sin huérfanas; FK de `expenses` conocida (v1).
3. **Backup manual reciente** confirmado (y PITR si disponible) — `BACKUP_RECOVERY.md`.
4. Ventana de mantenimiento corta acordada (locks de ms; bajo volumen).

## Método de aplicación (CRÍTICO)
**NO usar `supabase db push`** (arrastraría ~13 migraciones no registradas). Aplicar **solo los 16 archivos C2B en
aislamiento**, en orden, contra prod:

```
# Aplicar SOLO los 16 archivos C2B, en orden, en una transacción por bloque.
for f in supabase/migrations/20260724000001_contacheck_c2b_*.sql \
         ... 000016_contacheck_c2b_16_compat_flags.sql ; do
  psql "<PROD_CONN_READWRITE>" -v ON_ERROR_STOP=1 -f "$f"   # ejecutado por Juan / rol autorizado
done
```
(La conexión de escritura a prod la ejecuta Juan o el pipeline; el asistente no maneja esa credencial.)

Alternativa: registrar manualmente en `schema_migrations` las intermedias como "aplicadas" (reconciliación de
ledger) y luego `db push` — **más riesgoso**; se prefiere la aplicación aislada.

## Secuencia (16 bloques — ver `MIGRATION_MANIFEST.md` de C2B)
capacidades → periodos → catálogo → parties → perfil fiscal → vouchers_ext → numeración → líneas → orígenes →
idempotencia → dimensiones → reglas → rpc_generate → rpc_post_reverse → rls_grants → compat_flags.

## Verificación post-aplicación
1. `03` → 18 tablas nuevas presentes; `accounting_vouchers` con 41 columnas.
2. Confirmar `accounting_flag_mode(company,'*')` = `LEGACY` para las 6 empresas (nadie en CONTACHECK).
3. Humo: `accounting_can` responde; los 2 writers legacy siguen insertando (INSERT de prueba en staging, no en
   datos reales).
4. Regenerar tipos TS de `accounting_vouchers`/`accounting_accounts`.

## Rollback
- Lógico: `supabase/migrations/CONTACHECK_C2B_ROLLBACK.sql` (revierte solo objetos C2B; probado apply→rollback→
  reapply). Válido mientras **no** haya pólizas reales (prod hoy: 0).
- Físico: restaurar backup previo (segunda línea).

## Activación gradual (post-C3B, fuera de este runbook)
Empresa por empresa: `LEGACY` → `SHADOW` (BancoCheck) → validar → `CONTACHECK`. Nunca global.

## No incluido en C3B
- Adaptadores por evento / Edge Functions (fase posterior).
- Cambio de las rutas legacy a RPC (opt-in por flag).
- Retiro de `accounting_accounts_v2` (v2 vacío; retiro documental posterior).
