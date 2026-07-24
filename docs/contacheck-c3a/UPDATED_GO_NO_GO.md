# ContaCheck · C3A.1 — Gate GO/NO-GO actualizado (§12, §13, §14)

> Actualiza `GO_NO_GO.md` tras cerrar condiciones de C3A.1. **Sin cambios en prod. Sin activar flags. Sin C3B.**

## Matriz actualizada
| Control | Resultado | Cambio vs C3A |
|---|---|---|
| Identificación de entorno | **PASS** | = |
| Aclaración de método / `service_role` no es read-only | **PASS** (documentado) | **cerrado** |
| Escaneo de secretos del repo | **PASS con hallazgo** (tokens hardcodeados pre-existentes en utilidades `.js/.ps1`; no bloquea C2B; tarea aparte) | **nuevo** |
| Baseline contable presente | **PASS** | = |
| Datos compatibles (0 pólizas, v2 vacío) | **PASS** | = |
| **Auditoría SECURITY DEFINER (C2B)** | **PASS (21/21 search_path + criterios)** | **cerrado** |
| **Paquete aislado C3B** | **PASS (preparado, checksums, pre/postflight, runbook, stop)** | **cerrado** |
| **Reconciliación del historial** | **PASS (matriz + plan: aplicar aislado; housekeeping aparte)** | **cerrado** |
| **Equivalencia BancoCheck `20260721100000`** | **PARCIAL** (columnas+tipos ✓; FK/índices/RPC 9-arg/RLS pendientes de `05/06`) | **nuevo (parcial)** |
| Método de despliegue (no `db push`) | **PASS (resuelto por paquete aislado)** | **cerrado** |
| Colisión de funciones en prod | **WARNING** (inconcluso REST; preflight lo atrapa; confirmar `06`) | pendiente |
| Constraints/FK finos (expenses v1/v2) | **WARNING** (confirmar `05`) | pendiente |
| Triggers/RLS internos de prod | **WARNING** (confirmar `06/07`) | pendiente |
| Backup / PITR / restauración probada | **WARNING** (confirmar dashboard + snapshot previo) | pendiente |
| Validación de sintaxis de envoltorios en Postgres real | **WARNING** (Docker caído; ejecutar 1 vez) | nuevo |

## §12 — Plan de activación (criterios cuantitativos)
1. **LEGACY (estado inicial, todas las empresas).** Validar rutas actuales (BancoCheck web / FacturaCheck mobile) sin cambios.
2. **LEGACY → SHADOW** (por empresa piloto interna). *Criterios:* C2B aplicado + `17_postflight` PASS + `19` = 0
   fuera de LEGACY + backup confirmado + prechecks `05/06/07` PASS.
3. **SHADOW (BancoCheck):** generar propuesta con ContaCheck **sin contabilizar**, comparar contra el resultado
   legacy. *Criterio de avance:* **≥ 20 operaciones** o **≥ 5 días hábiles** con **0 discrepancias** en (cuentas,
   importes, balance debe=haber, IVA/retenciones). Toda diferencia se resuelve antes de avanzar.
4. **SHADOW → CONTACHECK (BancoCheck):** cuando el criterio anterior se cumple. Observación **≥ 5 días**.
5. **CONTACHECK → LEGACY (reversión):** disparo **inmediato** si: cualquier STOP condition; tasa de discrepancia
   > 0 no resuelta; póliza desbalanceada; error de RLS/idempotencia; folio duplicado.
6. **Repetir** el ciclo para **GastoCheck** (SHADOW → validación → CONTACHECK), y luego activación gradual del resto.
   Nunca activación global de un solo paso.

## §13 — Stop conditions
Definidas en `deploy/contacheck-c3b/STOP_CONDITIONS.md` (13 condiciones con evidencia · acción · rollback/forward-fix
· responsable · autorización). Resumen: cualquier fallo de precheck/bloque/humo/flag/RLS/balance/idempotencia/lock
→ **detener** y aplicar rollback lógico o forward-fix según la fila.

## §14 — Veredicto actualizado

```
GO PARA C3B CON CONDICIONES
```

**Justificación:** se **cerraron** las condiciones que dependían de análisis/preparación (aclaración de método,
escaneo de secretos, auditoría SECURITY DEFINER = 21/21 PASS, **paquete aislado C3B listo con checksums/runbook/
stop-conditions**, reconciliación del historial con plan claro, y resolución del riesgo de método vía aplicación
aislada). **Persisten condiciones que requieren una sesión con acceso DB o el dashboard** — por eso **no** es GO
pleno:
1. Ejecutar `scripts/contacheck-c3a/05,06,07` en prod (sesión de solo lectura de Juan) → **0 colisiones de
   función**, catálogo sano, FK de `expenses`, triggers/RLS sin sorpresas.
2. **Backup manual reciente + confirmar PITR/restaurabilidad** (dashboard).
3. Ejecutar una vez los **5 envoltorios** del paquete contra un Postgres real (staging/local) para validar sintaxis.
4. (Deseable antes de activar el adaptador BancoCheck, fase posterior) cerrar la **equivalencia PARCIAL** de
   `20260721100000` con `05/06`.

Cumplidas 1–3, el gate pasa a **GO PARA C3B** y el paquete `deploy/contacheck-c3b/` puede ejecutarse por el RUNBOOK.
No se declara GO pleno mientras sigan pendientes colisiones/funciones/triggers/constraints/RLS/grants/respaldo/PITR.
