# ContaCheck C3B — STOP CONDITIONS (detención inmediata)

> Si ocurre cualquiera, **detener el despliegue de inmediato**. Cada fila: evidencia · acción inmediata ·
> rollback/forward-fix · responsable · autorización para continuar.

| # | Condición | Evidencia | Acción inmediata | Rollback / Forward-fix | Responsable | Autorización para continuar |
|---|---|---|---|---|---|---|
| 1 | Falla un precheck | `00_preflight` aborta | No aplicar nada | n/a (no se cambió nada) | Juan | Resolver causa + reintentar preflight |
| 2 | Drift no documentado | preflight/postflight raise | Detener | Investigar objeto real | Juan/DBA | Documentar y re-evaluar GO |
| 3 | Definición existente no coincide | error `CREATE`/colisión | Detener | No forzar; revisar con `06` | DBA | Ajustar bloque local + re-test local |
| 4 | Falla un bloque | `ON_ERROR_STOP` corta en NN | El bloque NN quedó revertido | Rollback lógico si hubo bloques previos | Juan | Corregir y reanudar desde 00 |
| 5 | Migración parcialmente aplicada | postflight FAIL | Detener | `CONTACHECK_C2B_ROLLBACK.sql` | Juan | Reaplicar desde limpio |
| 6 | Falla una prueba de humo | `18_smoke` error no esperado | Detener (el smoke ya hizo ROLLBACK) | Investigar | Dev/DBA | Corregir + re-test local |
| 7 | Rutas legacy fallan | errores en BancoCheck/FacturaCheck web/mobile | Detener | Rollback lógico | Dev | Confirmar rutas OK |
| 8 | Flags no permanecen en LEGACY | `19_flag_verification` FAIL | Revertir flag afectado a LEGACY | `accounting_set_flag(...,'LEGACY')` | Juan | Confirmar 0 SHADOW/CONTACHECK |
| 9 | Permisos excesivos detectados | grants a anon/authenticated inesperados | Detener | Revocar; revisar bloque 15 | DBA | Auditoría de grants OK |
| 10 | Errores de RLS | fuga cross-company en prueba | Detener | Rollback lógico | DBA | RLS validado |
| 11 | Póliza no balanceada | `CHECK`/trigger dispara | Detener | Investigar RPC | Dev | Balance garantizado |
| 12 | Pérdida de idempotencia | duplicado por idempotency_key | Detener | Rollback lógico | Dev | Idempotencia validada |
| 13 | Bloqueo inesperado (lock) | consulta colgada > umbral | Cancelar sesión; detener | Reintentar en ventana | DBA | Lock analizado |

## Principio
Con **0 pólizas** en prod, el rollback lógico es de bajo costo; el backup es la red de segundo nivel. Nunca
continuar tras un STOP sin la autorización indicada.
