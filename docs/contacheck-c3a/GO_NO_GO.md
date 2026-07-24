# ContaCheck · C3A — Gate GO / NO-GO (§15)

> Matriz final. Evidencia real de prod (2026-07-24) + controles pendientes de script. **Sin cambios en prod.**

## Matriz de controles
| Control | Evidencia | Resultado | Riesgo | Acción requerida | Responsable |
|---|---|---|---|---|---|
| Identificación de entorno | checksuite `omhycwfjxynkfwywzwvz`, PG17, linked | **PASS** | — | — | — |
| Baseline contable presente | v1 301 filas, vouchers 15-col, deps core presentes | **PASS** | — | — | — |
| Colisión de tablas C2B | 18 tablas nuevas ausentes (404) | **PASS** | — | — | — |
| Datos compatibles con constraints | 0 pólizas, v2 vacío | **PASS** | Bajo | (confirmar huérfanas cat. con `05`) | Juan/DBA |
| `accounting_vouchers` shape original | 15 cols, sin cols C2B | **PASS** | — | — | — |
| Ledger de migraciones fiable | ~13 migraciones no registradas; cols aplicadas a mano | **FAIL (método)** | **Alto** | **No usar `db push`; aplicar 16 C2B aislados** | Juan/pipeline |
| Colisión de funciones C2B | inconcluso vía REST | **WARNING** | Medio | Ejecutar `06` (esperado 0 colisiones) | Juan/DBA |
| Constraints/FK exactos (expenses v1/v2) | no visible por REST | **WARNING** | Medio | Ejecutar `05` | Juan/DBA |
| Triggers en tablas afectadas | no visible por REST | **WARNING** | Medio | Ejecutar `06` (descartar guard inesperado) | Juan/DBA |
| RLS/políticas/grants sin bypass | no visible por REST | **WARNING** | Medio | Ejecutar `07` | Juan/DBA |
| Feature flags default LEGACY | infra la crea C2B; default LEGACY por diseño | **PASS** | — | verificar post-deploy | — |
| Compatibilidad de aplicación | 2 writers proveen voucher_number; aditivo | **PASS** | Bajo | regenerar tipos TS post-deploy | Dev |
| Backup / PITR / restauración probada | Pro daily backups (conocido); PITR/último restore sin confirmar | **WARNING** | Alto | Backup manual + confirmar PITR en dashboard | Juan |
| Simulación de migración | todas SEGURA/CONDICIONADA; 0 rewrites | **PASS** (contenido) | Bajo | — | — |

## Condiciones de aprobación (deben cumplirse antes de C3B)
1. **Método de despliegue aislado** de los 16 archivos C2B (no `db push`). — *bloqueante de método*
2. **Ejecutar scripts `05`, `06`, `07`** en prod (sesión de solo lectura) y confirmar: 0 colisiones de función,
   catálogo sano, sin triggers/políticas inesperadas más permisivas.
3. **Backup manual reciente** + confirmar PITR/restaurabilidad en el dashboard.

## Veredicto

```
GO CON CONDICIONES
```

**Justificación:** el **baseline contable de producción es compatible** con C2B y el cambio es **de muy bajo
riesgo de datos** (0 pólizas, `accounting_accounts_v2` vacío, 18 tablas nuevas sin colisión, deps core presentes,
sin rewrites). **No es NO-GO** porque no hay incompatibilidad de esquema ni datos que violen las nuevas
constraints. **No es GO pleno** porque persisten condiciones **no verificables en modo solo-lectura remoto**
(colisión de funciones, constraints/triggers/RLS finos, backup probado) y un **riesgo de método real y alto**: un
`supabase db push` arrastraría ~13 migraciones no registradas. Resueltas las 3 condiciones, el gate pasa a GO.
